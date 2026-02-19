#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const {
  parseLogFile,
  filterEntries,
  filterByStatus,
  aggregateByField,
  generateSummary
} = require('./index');

const program = new Command();

program
  .name('loganalyzer')
  .description('CLI tool to parse, filter, and aggregate log files with regex patterns')
  .version('1.0.0');

/**
 * Parse subcommand
 */
program
  .command('parse')
  .description('Parse and display log file structure')
  .argument('<file>', 'Log file path')
  .option('-f, --format <format>', 'Log format (auto, json, text, nginx, apache)', 'auto')
  .option('-l, --limit <number>', 'Limit number of entries to display', '10')
  .action((file, options) => {
    try {
      const limit = parseInt(options.limit);
      const parsed = parseLogFile(file, options.format);

      console.log(`\n📊 Log Analysis: ${file}`);
      console.log(`   Format: ${parsed.format}`);
      console.log(`   Total lines: ${parsed.totalLines}`);
      console.log(`   Parsed entries: ${parsed.parsedEntries}\n`);

      if (parsed.entries.length === 0) {
        console.log('⚠️  No entries found');
        return;
      }

      console.log('Sample entries:');
      parsed.entries.slice(0, limit).forEach((entry, idx) => {
        console.log(`\n[${idx + 1}]`);
        console.log(JSON.stringify(entry, null, 2));
      });

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Analyze subcommand
 */
program
  .command('analyze')
  .description('Analyze log file and generate statistics')
  .argument('<file>', 'Log file path')
  .option('-f, --format <format>', 'Log format (auto, json, text, nginx, apache)', 'auto')
  .option('--filter <pattern>', 'Filter entries by regex pattern')
  .option('--filter-field <field>', 'Filter on specific field')
  .option('--status <codes>', 'Filter by status codes (comma-separated, e.g., 404,500)')
  .option('--aggregate <field>', 'Aggregate entries by field')
  .option('--top <number>', 'Show top N results for aggregation', '10')
  .action((file, options) => {
    try {
      let entries = parseLogFile(file, options.format).entries;

      if (options.filter) {
        entries = filterEntries(entries, options.filter, options.filterField);
        console.log(`\n🔍 Filtered entries: ${entries.length}`);
      }

      if (options.status) {
        const statusCodes = options.status.split(',').map(s => parseInt(s.trim()));
        entries = filterByStatus(entries, statusCodes);
        console.log(`📊 Status-filtered entries: ${entries.length}`);
      }

      const summary = generateSummary({
        entries,
        format: options.format === 'auto' ? detectFormat(file) : options.format
      });

      console.log(`\n📈 Analysis Summary`);
      console.log(`   Total entries: ${summary.totalEntries}`);
      console.log(`   Fields: ${summary.fieldsDetected.join(', ')}\n`);

      if (summary.statusCounts) {
        console.log('Status Codes:');
        Object.entries(summary.statusCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
          });

        console.log(`\n   Error Rate: ${summary.errorRate}`);
        console.log(`   Client Errors (4xx): ${summary.clientErrors}`);
        console.log(`   Server Errors (5xx): ${summary.serverErrors}\n`);
      }

      if (summary.topPaths) {
        console.log('Top Paths:');
        summary.topPaths.forEach(([path, count]) => {
          console.log(`   ${path}: ${count}`);
        });
        console.log('');
      }

      if (options.aggregate) {
        const counts = aggregateByField(entries, options.aggregate);
        const topN = parseInt(options.top);
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);

        console.log(`Top ${topN} by ${options.aggregate}:`);
        sorted.forEach(([value, count]) => {
          console.log(`   ${value}: ${count}`);
        });
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Export subcommand
 */
program
  .command('export')
  .description('Export log analysis to file')
  .argument('<file>', 'Log file path')
  .argument('<output>', 'Output file path')
  .option('-f, --format <format>', 'Log format (auto, json, text, nginx, apache)', 'auto')
  .option('--filter <pattern>', 'Filter entries by regex pattern')
  .option('--status <codes>', 'Filter by status codes (comma-separated)')
  .option('--output-format <format>', 'Output format (json, csv)', 'json')
  .action((file, output, options) => {
    try {
      let entries = parseLogFile(file, options.format).entries;

      if (options.filter) {
        entries = filterEntries(entries, options.filter);
      }

      if (options.status) {
        const statusCodes = options.status.split(',').map(s => parseInt(s.trim()));
        entries = filterByStatus(entries, statusCodes);
      }

      const ext = path.extname(output).toLowerCase();
      const outputFormat = options.outputFormat === 'csv' || ext === '.csv' ? 'csv' : 'json';

      let content = '';

      if (outputFormat === 'csv') {
        if (entries.length === 0) {
          console.log('⚠️  No entries to export');
          return;
        }

        const headers = Object.keys(entries[0]);
        content = headers.join(',') + '\n';
        content += entries.map(entry => {
          return headers.map(h => {
            const val = entry[h];
            const str = val === undefined || val === null ? '' : String(val);
            return str.includes(',') ? `"${str}"` : str;
          }).join(',');
        }).join('\n');

      } else {
        content = JSON.stringify({
          source: file,
          exportedAt: new Date().toISOString(),
          totalEntries: entries.length,
          entries
        }, null, 2);
      }

      fs.writeFileSync(output, content, 'utf8');
      console.log(`✅ Exported ${entries.length} entries to ${output} (${outputFormat})`);

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Helper for analyze command
function detectFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'text';

  const firstLine = lines[0];
  try {
    JSON.parse(firstLine);
    return 'json';
  } catch {}

  const nginxPattern = /^\S+ \S+ \S+ \[[^\]]+\] "\S+ \S+ \S+" \d{3} \d+ ".*?" ".*?"$/;
  if (nginxPattern.test(firstLine)) return 'nginx';

  const apachePattern = /^\S+ \S+ \S+ \[[^\]]+\] "\S+ \S+ \S+" \d{3} \d+$/;
  if (apachePattern.test(firstLine)) return 'apache';

  return 'text';
}

program.parse();

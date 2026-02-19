const fs = require('fs');
const path = require('path');

/**
 * Detect log format from file content
 */
function detectFormat(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'text';

  const firstLine = lines[0];

  // Check for JSON logs
  try {
    JSON.parse(firstLine);
    return 'json';
  } catch {}

  // Check for nginx combined format
  const nginxPattern = /^\S+ \S+ \S+ \[[^\]]+\] "\S+ \S+ \S+" \d{3} \d+ ".*?" ".*?"$/;
  if (nginxPattern.test(firstLine)) return 'nginx';

  // Check for Apache combined format
  const apachePattern = /^\S+ \S+ \S+ \[[^\]]+\] "\S+ \S+ \S+" \d{3} \d+$/;
  if (apachePattern.test(firstLine)) return 'apache';

  return 'text';
}

/**
 * Parse nginx log line
 */
function parseNginxLine(line) {
  const regex = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d{3}) (\d+) "(.*?)" "(.*?)"$/;
  const match = line.match(regex);
  if (!match) return null;

  return {
    ip: match[1],
    identity: match[2],
    user: match[3],
    timestamp: match[4],
    method: match[5],
    path: match[6],
    protocol: match[7],
    status: parseInt(match[8]),
    size: parseInt(match[9]),
    referer: match[10] || '-',
    userAgent: match[11] || '-'
  };
}

/**
 * Parse Apache log line
 */
function parseApacheLine(line) {
  const regex = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d{3}) (\d+)$/;
  const match = line.match(regex);
  if (!match) return null;

  return {
    ip: match[1],
    identity: match[2],
    user: match[3],
    timestamp: match[4],
    method: match[5],
    path: match[6],
    protocol: match[7],
    status: parseInt(match[8]),
    size: parseInt(match[9])
  };
}

/**
 * Parse JSON log line
 */
function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * Parse log file based on format
 */
function parseLogFile(filePath, format = 'auto') {
  const content = fs.readFileSync(filePath, 'utf8');
  const detectedFormat = format === 'auto' ? detectFormat(content) : format;
  const lines = content.split('\n').filter(l => l.trim());

  const entries = lines.map(line => {
    switch (detectedFormat) {
      case 'nginx':
        return parseNginxLine(line);
      case 'apache':
        return parseApacheLine(line);
      case 'json':
        return parseJsonLine(line);
      case 'text':
      default:
        return { raw: line };
    }
  }).filter(entry => entry !== null);

  return {
    format: detectedFormat,
    entries,
    totalLines: lines.length,
    parsedEntries: entries.length
  };
}

/**
 * Filter entries by regex pattern
 */
function filterEntries(entries, pattern, field = null) {
  const regex = new RegExp(pattern, 'i');

  return entries.filter(entry => {
    if (field) {
      const value = entry[field];
      if (value === undefined || value === null) return false;
      return regex.test(String(value));
    }
    return regex.test(JSON.stringify(entry));
  });
}

/**
 * Filter entries by status codes
 */
function filterByStatus(entries, statusCodes) {
  return entries.filter(entry => entry.status && statusCodes.includes(entry.status));
}

/**
 * Aggregate entries by field
 */
function aggregateByField(entries, field) {
  const counts = {};

  entries.forEach(entry => {
    const value = entry[field] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  });

  return counts;
}

/**
 * Calculate time-based stats for logs
 */
function calculateTimeStats(entries) {
  const timeBuckets = {
    hour: {},
    minute: {}
  };

  entries.forEach(entry => {
    if (entry.timestamp) {
      try {
        const date = new Date(entry.timestamp);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          const minute = `${hour}:${String(date.getMinutes()).padStart(2, '0')}`;

          timeBuckets.hour[hour] = (timeBuckets.hour[hour] || 0) + 1;
          timeBuckets.minute[minute] = (timeBuckets.minute[minute] || 0) + 1;
        }
      } catch {}
    }
  });

  return timeBuckets;
}

/**
 * Generate summary statistics
 */
function generateSummary(parsed) {
  const { entries, format } = parsed;
  const summary = {
    format,
    totalEntries: entries.length,
    fieldsDetected: []
  };

  if (entries.length === 0) return summary;

  // Detect fields
  const fields = new Set();
  entries.forEach(entry => {
    Object.keys(entry).forEach(key => fields.add(key));
  });
  summary.fieldsDetected = Array.from(fields);

  // Status code analysis (if applicable)
  if (format === 'nginx' || format === 'apache') {
    const statusCounts = aggregateByField(entries, 'status');
    summary.statusCounts = statusCounts;

    const errorEntries = filterByStatus(entries, [400, 401, 403, 404, 500, 502, 503, 504]);
    summary.errorCount = errorEntries.length;
    summary.errorRate = ((errorEntries.length / entries.length) * 100).toFixed(2) + '%';

    const status4xx = filterByStatus(entries, [400, 401, 403, 404]).length;
    const status5xx = filterByStatus(entries, [500, 502, 503, 504]).length;
    summary.clientErrors = status4xx;
    summary.serverErrors = status5xx;
  }

  // Top paths (if applicable)
  if (format === 'nginx' || format === 'apache') {
    const pathCounts = aggregateByField(entries, 'path');
    const sortedPaths = Object.entries(pathCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    summary.topPaths = sortedPaths;
  }

  // Time-based stats
  const timeStats = calculateTimeStats(entries);
  summary.timeStats = timeStats;

  return summary;
}

module.exports = {
  detectFormat,
  parseLogFile,
  filterEntries,
  filterByStatus,
  aggregateByField,
  calculateTimeStats,
  generateSummary
};

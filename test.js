const {
  detectFormat,
  parseLogFile,
  filterEntries,
  filterByStatus,
  aggregateByField,
  generateSummary
} = require('./index');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running log-analyzer-cli tests...\n');

// Test data setup
const testDataDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Create test nginx log
const nginxLog = `192.168.1.1 - - [19/Feb/2026:10:00:00 +0000] "GET /api/v1/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
192.168.1.2 - - [19/Feb/2026:10:00:01 +0000] "GET /api/v1/posts HTTP/1.1" 200 567 "https://example.com" "Mozilla/5.0"
192.168.1.3 - - [19/Feb/2026:10:00:02 +0000] "GET /api/v1/nonexistent HTTP/1.1" 404 89 "-" "curl/7.68.0"
192.168.1.1 - - [19/Feb/2026:10:00:03 +0000] "POST /api/v1/auth/login HTTP/1.1" 500 234 "-" "Mozilla/5.0"
192.168.1.4 - - [19/Feb/2026:10:00:04 +0000] "GET /api/v1/users HTTP/1.1" 403 45 "-" "curl/7.68.0"`;

fs.writeFileSync(path.join(testDataDir, 'nginx.log'), nginxLog);

// Create test JSON log
const jsonLog = `{"timestamp": "2026-02-19T10:00:00Z", "level": "info", "message": "Server started"}
{"timestamp": "2026-02-19T10:00:01Z", "level": "info", "message": "Request received", "path": "/api/v1/users"}
{"timestamp": "2026-02-19T10:00:02Z", "level": "error", "message": "Database connection failed"}
{"timestamp": "2026-02-19T10:00:03Z", "level": "info", "message": "Request received", "path": "/api/v1/posts"}
{"timestamp": "2026-02-19T10:00:04Z", "level": "warn", "message": "High memory usage"}`;

fs.writeFileSync(path.join(testDataDir, 'json.log'), jsonLog);

// Create test text log
const textLog = `[2026-02-19 10:00:00] INFO: Server started
[2026-02-19 10:00:01] INFO: Processing request
[2026-02-19 10:00:02] ERROR: Connection timeout
[2026-02-19 10:00:03] WARN: Slow query detected
[2026-02-19 10:00:04] INFO: Request completed`;

fs.writeFileSync(path.join(testDataDir, 'text.log'), textLog);

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Format detection
test('Detect nginx format', () => {
  const format = detectFormat(nginxLog);
  if (format !== 'nginx') throw new Error(`Expected nginx, got ${format}`);
});

test('Detect JSON format', () => {
  const format = detectFormat(jsonLog);
  if (format !== 'json') throw new Error(`Expected json, got ${format}`);
});

test('Detect text format', () => {
  const format = detectFormat(textLog);
  if (format !== 'text') throw new Error(`Expected text, got ${format}`);
});

// Test 2: Parse nginx log
test('Parse nginx log file', () => {
  const result = parseLogFile(path.join(testDataDir, 'nginx.log'), 'nginx');
  if (result.format !== 'nginx') throw new Error('Format mismatch');
  if (result.parsedEntries !== 5) throw new Error(`Expected 5 entries, got ${result.parsedEntries}`);
  if (result.entries[0].status !== 200) throw new Error('Status parsing failed');
});

// Test 3: Parse JSON log
test('Parse JSON log file', () => {
  const result = parseLogFile(path.join(testDataDir, 'json.log'), 'json');
  if (result.format !== 'json') throw new Error('Format mismatch');
  if (result.parsedEntries !== 5) throw new Error(`Expected 5 entries, got ${result.parsedEntries}`);
  if (result.entries[0].level !== 'info') throw new Error('Level parsing failed');
});

// Test 4: Parse text log
test('Parse text log file', () => {
  const result = parseLogFile(path.join(testDataDir, 'text.log'), 'text');
  if (result.format !== 'text') throw new Error('Format mismatch');
  if (result.parsedEntries !== 5) throw new Error(`Expected 5 entries, got ${result.parsedEntries}`);
});

// Test 5: Filter by regex
test('Filter entries by regex pattern', () => {
  const parsed = parseLogFile(path.join(testDataDir, 'json.log'), 'json');
  const filtered = filterEntries(parsed.entries, 'error', 'level');
  if (filtered.length !== 1) throw new Error(`Expected 1 error entry, got ${filtered.length}`);
});

// Test 6: Filter by status
test('Filter entries by status code', () => {
  const parsed = parseLogFile(path.join(testDataDir, 'nginx.log'), 'nginx');
  const filtered = filterByStatus(parsed.entries, [404, 500]);
  if (filtered.length !== 2) throw new Error(`Expected 2 error entries, got ${filtered.length}`);
});

// Test 7: Aggregate by field
test('Aggregate entries by field', () => {
  const parsed = parseLogFile(path.join(testDataDir, 'nginx.log'), 'nginx');
  const aggregated = aggregateByField(parsed.entries, 'status');
  if (aggregated[200] !== 2) throw new Error(`Expected 200: 2, got ${aggregated[200]}`);
  if (aggregated[404] !== 1) throw new Error(`Expected 404: 1, got ${aggregated[404]}`);
});

// Test 8: Generate summary
test('Generate summary statistics', () => {
  const parsed = parseLogFile(path.join(testDataDir, 'nginx.log'), 'nginx');
  const summary = generateSummary(parsed);

  if (summary.totalEntries !== 5) throw new Error(`Expected 5 entries, got ${summary.totalEntries}`);
  if (summary.clientErrors !== 2) throw new Error(`Expected 2 client errors, got ${summary.clientErrors}`);
  if (summary.serverErrors !== 1) throw new Error(`Expected 1 server error, got ${summary.serverErrors}`);
  if (!summary.topPaths || summary.topPaths.length === 0) throw new Error('Expected top paths');
});

// Test 9: Summary with JSON logs
test('Generate summary for JSON logs', () => {
  const parsed = parseLogFile(path.join(testDataDir, 'json.log'), 'json');
  const summary = generateSummary(parsed);

  if (summary.totalEntries !== 5) throw new Error(`Expected 5 entries, got ${summary.totalEntries}`);
  if (!summary.fieldsDetected.includes('level')) throw new Error('Expected level field');
});

// Test 10: Empty file handling
test('Handle empty log file', () => {
  const emptyFile = path.join(testDataDir, 'empty.log');
  fs.writeFileSync(emptyFile, '');
  const result = parseLogFile(emptyFile, 'text');
  if (result.parsedEntries !== 0) throw new Error('Expected 0 entries for empty file');
});

// Cleanup
fs.rmSync(testDataDir, { recursive: true, force: true });

// Results
console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);

if (testsFailed > 0) {
  process.exit(1);
}

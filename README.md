# log-analyzer-cli

A powerful CLI tool to parse, filter, and aggregate log files with regex patterns. Supports multiple formats including JSON, text, nginx, and Apache logs.

## Features

- 📊 **Multiple format support**: JSON, plain text, nginx combined, Apache combined
- 🔍 **Regex filtering**: Filter entries by pattern or specific field
- 📈 **Statistics**: Error counts, status codes, time-based analytics
- 📤 **Export**: Export results to JSON or CSV
- 🚀 **Fast**: Efficient parsing and aggregation

## Installation

```bash
npm install -g log-analyzer-cli
```

Or use directly from source:

```bash
cd log-analyzer-cli
npm link
```

## Usage

### Parse Log File

Display log file structure and sample entries:

```bash
loganalyzer parse access.log
loganalyzer parse access.log --format nginx --limit 20
```

Options:
- `-f, --format <format>`: Log format (auto, json, text, nginx, apache)
- `-l, --limit <number>`: Number of entries to display (default: 10)

### Analyze Log File

Generate comprehensive statistics and analysis:

```bash
loganalyzer analyze access.log
loganalyzer analyze access.log --filter "ERROR"
loganalyzer analyze access.log --status 404,500
loganalyzer analyze access.log --aggregate path --top 20
```

Options:
- `-f, --format <format>`: Log format
- `--filter <pattern>`: Filter by regex pattern
- `--filter-field <field>`: Filter on specific field
- `--status <codes>`: Filter by status codes (comma-separated)
- `--aggregate <field>`: Aggregate entries by field
- `--top <number>`: Show top N results (default: 10)

### Export Results

Export filtered/analyzed logs to JSON or CSV:

```bash
loganalyzer export access.log output.json
loganalyzer export access.log output.csv --status 500 --output-format csv
loganalyzer export access.log filtered.json --filter "ERROR"
```

Options:
- `-f, --format <format>`: Input log format
- `--filter <pattern>`: Filter by regex pattern
- `--status <codes>`: Filter by status codes
- `--output-format <format>`: Output format (json, csv)

## Examples

### Nginx Access Log Analysis

```bash
# Basic analysis
loganalyzer analyze /var/log/nginx/access.log --format nginx

# Find 404 errors
loganalyzer analyze access.log --status 404

# Top paths
loganalyzer analyze access.log --aggregate path --top 50

# Export errors to CSV
loganalyzer export access.log errors.csv --status 400,401,403,404,500
```

### JSON Application Logs

```bash
# Parse JSON logs
loganalyzer parse app.log --format json

# Filter by level
loganalyzer analyze app.log --filter "level.*error" --filter-field level

# Aggregate by service
loganalyzer analyze app.log --aggregate service
```

### Plain Text Logs

```bash
# Basic text analysis
loganalyzer analyze system.log --format text

# Filter for specific patterns
loganalyzer analyze system.log --filter "WARN|ERROR"
```

## Output Examples

### Summary Statistics

```
📈 Analysis Summary
   Total entries: 15234
   Fields: ip, identity, user, timestamp, method, path, protocol, status, size, referer, userAgent

Status Codes:
   200: 12450
   404: 1823
   500: 456
   403: 505

   Error Rate: 18.22%
   Client Errors (4xx): 2328
   Server Errors (5xx): 456

Top Paths:
   /api/v1/users: 4523
   /api/v1/posts: 3210
   /api/v1/auth/login: 1890
```

### Export Format (JSON)

```json
{
  "source": "access.log",
  "exportedAt": "2026-02-19T04:56:00.000Z",
  "totalEntries": 15234,
  "entries": [...]
}
```

## Supported Log Formats

### JSON Logs

```json
{"timestamp": "2026-02-19T10:00:00Z", "level": "info", "message": "Request received"}
```

### Nginx Combined Format

```
192.168.1.1 - - [19/Feb/2026:10:00:00 +0000] "GET /api/v1/users HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0"
```

### Apache Combined Format

```
192.168.1.1 - - [19/Feb/2026:10:00:00 +0000] "GET /api/v1/users HTTP/1.1" 200 1234
```

### Plain Text

Any text logs with flexible parsing and regex filtering.

## License

MIT

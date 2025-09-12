# OpenSearch Query Runner

A VSCode extension that allows you to execute SQL and PPL queries against OpenSearch clusters directly from markdown files, similar to the REST Client extension.

## Features

- 🔍 **Execute SQL and PPL queries** against OpenSearch clusters
- 📝 **Markdown integration** - Write queries in code blocks with syntax highlighting
- 🎯 **CodeLens support** - Click "Run Query" buttons above query blocks
- 📊 **Dual display modes** - View results inline or in a separate tab
- 📚 **Query history** - Track and rerun previous queries (separate tab mode)
- ⚙️ **Flexible authentication** - Support for basic auth, API keys, or no auth
- 🔧 **Configuration management** - Easy setup through VSCode settings
- 📋 **Per-document configuration** - Override connection settings within markdown files

## Quick Start

1. **Install the extension** from the VSCode marketplace
2. **Configure your OpenSearch connection**:
   - Click the OpenSearch status bar item, or
   - Use Command Palette → "OpenSearch: Configure Connection"
3. **Create a markdown file** with SQL or PPL queries:

```sql
-- Description: Get recent log entries
SELECT timestamp, level, message 
FROM logs 
WHERE timestamp > '2023-01-01' 
ORDER BY timestamp DESC 
LIMIT 10
```

```ppl
-- Description: Analyze log levels
source=logs 
| where timestamp > '2023-01-01' 
| stats count() by level 
| sort count desc
```

4. **Run queries** by clicking the CodeLens buttons above each query block

## Usage

### Writing Queries

Create code blocks in markdown files using `sql` or `ppl` language identifiers:

````markdown
```sql
SELECT * FROM my_index WHERE field = 'value'
```

```ppl
source=my_index | where field='value' | head 10
```
````

### Query Metadata

Add metadata to your queries using comments:

```sql
-- Description: What this query does
-- Timeout: 30s
-- Connection: my-cluster
SELECT * FROM logs LIMIT 10
```

### Running Queries

- **CodeLens**: Click "Run Query", "Inline", or "Separate Tab" above query blocks
- **Command Palette**: Use "OpenSearch: Run Query" commands
- **Context Menu**: Right-click in query blocks for options

### Display Modes

- **Inline**: Results appear directly below the query in the markdown file
- **Separate Tab**: Results open in a dedicated tab with history and advanced formatting

## Configuration

Configure the extension through VSCode settings:

```json
{
  "opensearch.endpoint": "http://localhost:9200",
  "opensearch.auth.type": "none",
  "opensearch.auth.username": "",
  "opensearch.auth.password": "",
  "opensearch.auth.apiKey": "",
  "opensearch.timeout": 30000,
  "opensearch.maxHistoryItems": 100,
  "opensearch.enableCodeLens": true
}
```

### Authentication Types

- **None**: No authentication required
- **Basic**: Username and password authentication
- **API Key**: API key authentication

## Per-Document Configuration

You can override connection settings within markdown documents using configuration blocks. This is perfect for working with multiple clusters or different authentication methods in a single document.

### Configuration Block Syntax

Create configuration blocks using `config`, `opensearch-config`, or `connection` language identifiers:

````markdown
```config
@endpoint = 'http://localhost:9200'
@auth_type = 'none'
@timeout = '30s'
```

```sql
-- This query uses the configuration above
SELECT * FROM my_index LIMIT 10
```
````

### Supported Configuration Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `@endpoint` | OpenSearch cluster URL | `@endpoint = 'http://localhost:9200'` |
| `@auth_type` | Authentication type | `@auth_type = 'basic'` |
| `@username` | Username for basic auth | `@username = 'admin'` |
| `@password` | Password for basic auth | `@password = 'secret'` |
| `@api_key` | API key for apikey auth | `@api_key = 'my-api-key'` |
| `@timeout` | Request timeout | `@timeout = '30s'` |

### Multi-Cluster Example

````markdown
# Development Environment
```config
@endpoint = 'http://localhost:9200'
@auth_type = 'none'
```

```sql
-- Query development cluster
SELECT COUNT(*) FROM dev_logs
```

# Production Environment
```config
@endpoint = 'https://prod-cluster:9200'
@auth_type = 'basic'
@username = 'readonly'
@password = 'secure_password'
@timeout = '60s'
```

```sql
-- Query production cluster with extended timeout
SELECT COUNT(*) FROM prod_logs WHERE timestamp > NOW() - INTERVAL 1 DAY
```
````

### Configuration Cascade Behavior

- Configuration blocks apply to all queries that follow them in the document
- Each query uses the closest preceding configuration block
- Falls back to global VSCode settings if no configuration block is found
- Invalid configurations show clear error messages with validation details

## Commands

- `OpenSearch: Run Query` - Execute query at cursor position
- `OpenSearch: Run Query (Inline)` - Execute with inline results
- `OpenSearch: Run Query (Separate Tab)` - Execute with separate tab results
- `OpenSearch: Show Query History` - View query history
- `OpenSearch: Configure Connection` - Set up OpenSearch connection

## Requirements

- VSCode 1.74.0 or higher
- Access to an OpenSearch cluster
- OpenSearch cluster with SQL/PPL plugins enabled

## Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `opensearch.endpoint` | OpenSearch cluster endpoint URL | `http://localhost:9200` |
| `opensearch.auth.type` | Authentication type (none/basic/apikey) | `none` |
| `opensearch.auth.username` | Username for basic auth | `""` |
| `opensearch.auth.password` | Password for basic auth | `""` |
| `opensearch.auth.apiKey` | API key for authentication | `""` |
| `opensearch.timeout` | Request timeout in milliseconds | `30000` |
| `opensearch.maxHistoryItems` | Maximum history items to keep | `100` |
| `opensearch.enableCodeLens` | Enable CodeLens for query blocks | `true` |

## Known Issues

- Query validation is basic and may not catch all syntax errors
- Large result sets may impact performance in inline mode
- History is only saved for separate tab mode queries

## Release Notes

### 0.1.0

Initial release with core functionality:
- SQL and PPL query execution
- Inline and separate tab result display
- Query history management
- CodeLens integration
- Authentication support
- Per-document configuration blocks with `@variable = 'value'` syntax
- Multi-cluster support with cascade behavior
- Configuration validation and error handling

## Contributing

This extension is open source. Contributions are welcome!

## License

MIT License - see LICENSE file for details.

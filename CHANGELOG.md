# Change Log

All notable changes to the "OpenSearch Query Runner" extension will be documented in this file.

## [0.1.0] - 2024-12-09

### Added
- Initial release of OpenSearch Query Runner extension
- Execute SQL and PPL queries against OpenSearch clusters from markdown files
- CodeLens integration with "Run Query", "Inline", and "Separate Tab" buttons
- Dual display modes:
  - Inline results: Insert formatted results directly in markdown
  - Separate tab: Open results in dedicated webview with table/JSON views
- Query history management for separate tab mode
- Connection management with multiple authentication types:
  - No authentication
  - Basic authentication (username/password)
  - API key authentication
- Query metadata support via comments:
  - `-- Description: Query description`
  - `-- Timeout: 30s`
  - `-- Connection: cluster-name` (for future use)
- Status bar integration showing connection status
- Hover provider with query information and validation
- Code action provider for query operations
- Configuration management through VSCode settings
- Query validation for basic SQL and PPL syntax
- Welcome message and example document on first use
- Comprehensive error handling and user feedback

### Features
- **SQL Query Support**: Execute SQL queries against `/_plugins/_sql` endpoint
- **PPL Query Support**: Execute PPL queries against `/_plugins/_ppl` endpoint
- **Markdown Integration**: Write queries in fenced code blocks with `sql` or `ppl` language tags
- **Real-time Validation**: Basic syntax validation with error highlighting
- **Result Formatting**: Automatic formatting of results as tables or JSON
- **Query History**: Track execution history with timestamps and results
- **Export Functionality**: Export query history to JSON format
- **Progress Indicators**: Visual feedback during query execution
- **Connection Testing**: Automatic connection validation with cluster info

### Technical Details
- Built with TypeScript for type safety
- Uses VSCode Extension API 1.74.0+
- HTTP-based communication with OpenSearch clusters
- Axios for HTTP requests with timeout and authentication support
- Webview-based results display with VSCode theming
- Persistent storage for query history using VSCode global state
- CodeLens and Language Server Protocol integration

### Configuration Options
- `opensearch.endpoint`: OpenSearch cluster endpoint URL
- `opensearch.auth.type`: Authentication type (none/basic/apikey)
- `opensearch.auth.username`: Username for basic authentication
- `opensearch.auth.password`: Password for basic authentication
- `opensearch.auth.apiKey`: API key for authentication
- `opensearch.timeout`: Request timeout in milliseconds
- `opensearch.maxHistoryItems`: Maximum number of history items to keep
- `opensearch.enableCodeLens`: Enable/disable CodeLens functionality

### Commands
- `opensearch-query.runQuery`: Run query at cursor position
- `opensearch-query.runQueryInline`: Run query with inline results
- `opensearch-query.runQueryInTab`: Run query in separate tab
- `opensearch-query.showHistory`: Show query history panel
- `opensearch-query.configureConnection`: Configure OpenSearch connection
- `opensearch-query.formatQuery`: Format query content

### Known Limitations
- Query validation is basic and may not catch all syntax errors
- Large result sets may impact performance in inline mode
- History is only saved for separate tab mode queries
- No support for multiple connection profiles (planned for future release)
- Limited query formatting capabilities

### Requirements
- VSCode 1.74.0 or higher
- Access to OpenSearch cluster with SQL/PPL plugins enabled
- Network connectivity to OpenSearch cluster

---

## Future Releases

### Planned Features for 0.2.0
- Multiple connection profiles
- Enhanced query syntax highlighting
- Query autocompletion
- Result export to CSV/JSON files
- Query performance metrics
- Collaborative query sharing
- Integration with OpenSearch Dashboards

### Planned Features for 0.3.0
- Query templates and snippets
- Advanced result visualization
- Query scheduling and automation
- Plugin system for custom formatters
- Enhanced error diagnostics
- Query optimization suggestions

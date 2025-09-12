# OpenSearch Query Runner - VSCode Extension Plan

## Project Overview
**Extension Name**: OpenSearch Query Runner  
**Purpose**: Execute SQL/PPL queries against OpenSearch clusters directly from markdown files, similar to REST Client  
**Target**: VSCode Extension Marketplace

## Requirements Summary
- Execute SQL and PPL queries from markdown code blocks
- HTTP-based connection to OpenSearch (version independent)
- Two display modes: inline results and separate tab
- Query history for separate tab mode
- CodeLens integration for easy query execution

## Architecture Design

### Core Components

#### 1. Connection Management (`connectionManager.ts`)
- HTTP client for OpenSearch API calls
- Configuration management via VSCode settings
- Authentication support (basic auth, API key, none)
- Connection validation and health checks

#### 2. Markdown Parser (`markdownParser.ts`)
- Detect `sql` and `ppl` code blocks in markdown files
- Extract query content and position information
- Support for query metadata in comments

#### 3. Query Runner (`queryRunner.ts`)
- Execute queries against OpenSearch `_sql` and `_ppl` endpoints
- Handle different response formats
- Error handling and timeout management
- Result formatting and processing

#### 4. Results Provider (`resultsProvider.ts`)
- Inline mode: Insert results below query blocks
- Separate tab mode: Create webview panel with formatted results
- Support for tabular and JSON views

#### 5. History Manager (`historyManager.ts`)
- Store executed queries with metadata
- Search and filter capabilities
- Re-execution of historical queries
- Export functionality

#### 6. CodeLens Provider (`codeLensProvider.ts`)
- Add "Run Query" actions above code blocks
- Integration with VSCode's CodeLens API
- Context-aware command registration

### File Structure
```
opensearch-query/
├── package.json                 # Extension manifest
├── tsconfig.json               # TypeScript configuration
├── webpack.config.js           # Bundling configuration
├── README.md                   # Documentation
├── CHANGELOG.md               # Version history
├── src/
│   ├── extension.ts           # Main entry point
│   ├── connectionManager.ts   # OpenSearch connections
│   ├── markdownParser.ts      # Query detection
│   ├── queryRunner.ts         # Execution logic
│   ├── resultsProvider.ts     # Display management
│   ├── historyManager.ts      # Query history
│   ├── codeLensProvider.ts    # CodeLens integration
│   ├── types.ts              # Type definitions
│   └── webview/
│       ├── resultsPanel.html  # Results webview
│       ├── resultsPanel.css   # Styling
│       └── resultsPanel.js    # Client-side logic
├── resources/
│   └── icons/
│       ├── opensearch.svg     # Extension icon
│       └── query.svg          # Command icons
└── test/
    ├── suite/
    │   └── extension.test.ts  # Unit tests
    └── runTest.ts            # Test runner
```

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure
- [x] Create plan document
- [ ] Initialize VSCode extension project
- [ ] Set up TypeScript configuration
- [ ] Create basic package.json with extension manifest
- [ ] Implement connection manager with HTTP client

### Phase 2: Query Detection & Parsing
- [ ] Implement markdown parser for SQL/PPL blocks
- [ ] Create CodeLens provider for query actions
- [ ] Add query validation and syntax checking

### Phase 3: Query Execution Engine
- [ ] Build query runner with OpenSearch API integration
- [ ] Implement error handling and response processing
- [ ] Add support for different query types (SQL/PPL)

### Phase 4: Results Display System
- [ ] Create inline results insertion
- [ ] Build separate tab webview for results
- [ ] Implement result formatting (table, JSON views)

### Phase 5: History & Advanced Features
- [ ] Implement query history management
- [ ] Add configuration management UI
- [ ] Create export/import functionality

### Phase 6: Testing & Polish
- [ ] Write comprehensive tests
- [ ] Add documentation and examples
- [ ] Package extension for distribution

## Technical Specifications

### VSCode Extension API Usage
- `vscode.languages.registerCodeLensProvider` - CodeLens integration
- `vscode.window.createWebviewPanel` - Results display
- `vscode.workspace.getConfiguration` - Settings management
- `vscode.commands.registerCommand` - Command registration

### OpenSearch API Endpoints
- `POST /_plugins/_sql` - SQL query execution
- `POST /_plugins/_ppl` - PPL query execution
- `GET /_cluster/health` - Connection validation

### Configuration Schema
```json
{
  "opensearch.endpoint": "http://localhost:9200",
  "opensearch.auth.type": "none|basic|apikey",
  "opensearch.auth.username": "",
  "opensearch.auth.password": "",
  "opensearch.auth.apiKey": "",
  "opensearch.timeout": 30000,
  "opensearch.maxHistoryItems": 100
}
```

### Query Block Format
```markdown
```sql
-- Connection: local-cluster
-- Timeout: 30s
SELECT * FROM logs WHERE timestamp > '2023-01-01'
```

```ppl
-- Connection: local-cluster
source=logs | where timestamp > '2023-01-01' | head 10
```
```

## User Experience Flow

1. **Setup**: Configure OpenSearch connection in VSCode settings
2. **Query Creation**: Write SQL/PPL queries in markdown code blocks
3. **Execution**: Click CodeLens "Run Query" button
4. **Mode Selection**: Choose inline or separate tab display
5. **Results**: View formatted results with metadata
6. **History**: Access previous queries from history panel (separate tab mode)

## Success Criteria
- [ ] Successfully execute SQL queries against OpenSearch
- [ ] Successfully execute PPL queries against OpenSearch
- [ ] Inline results display correctly in markdown
- [ ] Separate tab results show formatted data
- [ ] Query history functions properly
- [ ] Extension works with different OpenSearch versions
- [ ] Proper error handling and user feedback
- [ ] Performance acceptable for typical query sizes

## Future Enhancements
- Query autocompletion and syntax highlighting
- Multiple connection profiles
- Result export to CSV/JSON
- Query performance metrics
- Collaborative query sharing
- Integration with OpenSearch Dashboards

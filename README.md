# OpenSearch Query Runner

A VSCode extension that allows you to execute SQL and PPL queries against OpenSearch clusters directly from markdown and reStructuredText (RST) files, similar to the REST Client extension.

## Features

- 🔍 **Execute SQL, PPL, and REST API queries** against OpenSearch clusters
- 📝 **Markdown and RST integration** - Write queries in code blocks with syntax highlighting
- 🎯 **CodeLens support** - Click "Run Query" buttons above query blocks
- 📊 **Dual display modes** - View results inline or in a separate tab
- 📚 **Query history** - Track and rerun previous queries (separate tab mode)
- ⚙️ **Flexible authentication** - Support for basic auth, API keys, or no auth
- 🔧 **Configuration management** - Easy setup through VSCode settings
- 📋 **Per-document configuration** - Override connection settings within markdown files
- 🌐 **HTTP request line format** - Use familiar `GET /index/_search` syntax for REST API calls

## Quick Start

1. **Install the extension** from the VSCode marketplace
2. **Configure your OpenSearch connection**:
   - Click the OpenSearch status bar item, or
   - Use Command Palette → "OpenSearch: Configure Connection"
3. **Create a markdown or RST file** with SQL or PPL queries:

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

Create code blocks in markdown or RST files using `sql`, `ppl`, or `opensearch-api` language identifiers:

**Markdown Format:**

````markdown
```sql
SELECT * FROM my_index WHERE field = 'value'
```

```ppl
source=my_index | where field='value' | head 10
```

```opensearch-api
GET /my_index/_search
{
  "query": {
    "match": {
      "field": "value"
    }
  }
}
```
````

**reStructuredText (RST) Format:**

````rst
.. code-block:: sql

   SELECT * FROM my_index WHERE field = 'value'

.. code-block:: ppl

   source=my_index | where field='value' | head 10

.. code-block:: opensearch-api

   GET /my_index/_search
   {
     "query": {
       "match": {
         "field": "value"
       }
     }
   }
````

### OpenSearch REST API Queries

The extension supports OpenSearch REST API operations using two flexible formats:

#### HTTP Request Line Format (Recommended)

Use the familiar HTTP request line format at the beginning of your API blocks:

**Markdown:**
````markdown
```opensearch-api
GET /logs/_search
-- Description: Search for error logs
{
  "query": {
    "match": {
      "level": "ERROR"
    }
  }
}
```

```opensearch-api
POST /logs/_doc
-- Description: Index a new log entry
{
  "timestamp": "2024-01-15T10:00:00Z",
  "level": "INFO",
  "message": "Application started"
}
```
````

**reStructuredText (RST):**
````rst
.. code-block:: opensearch-api

   GET /logs/_search
   # Description: Search for error logs
   {
     "query": {
       "match": {
         "level": "ERROR"
       }
     }
   }

.. code-block:: opensearch-api

   POST /logs/_doc
   # Description: Index a new log entry
   {
     "timestamp": "2024-01-15T10:00:00Z",
     "level": "INFO",
     "message": "Application started"
   }
````

#### Traditional Metadata Format (Still Supported)

Use metadata comments to specify method and endpoint:

**Markdown:**
````markdown
```opensearch-api
-- Method: GET
-- Endpoint: /logs/_search
-- Description: Search for error logs
{
  "query": {
    "match": {
      "level": "ERROR"
    }
  }
}
```
````

**reStructuredText (RST):**
````rst
.. code-block:: opensearch-api

   # Method: GET
   # Endpoint: /logs/_search
   # Description: Search for error logs
   {
     "query": {
       "match": {
         "level": "ERROR"
       }
     }
   }
````

**Key Features:**
- **Backwards Compatible**: Existing documents with metadata comments continue to work
- **Override Support**: Metadata comments can override HTTP request line values
- **Flexible**: Mix both formats in the same document
- **Intuitive**: HTTP request line format is more familiar to developers

**Supported HTTP Methods:**
- `GET` - Retrieve data
- `POST` - Create or search operations
- `PUT` - Create or update operations
- `DELETE` - Delete operations
- `HEAD` - Check if resource exists

### Query Metadata

Add metadata to your queries using comments:

**Markdown:**
```sql
-- Description: What this query does
-- Timeout: 30s
-- Connection: my-cluster
SELECT * FROM logs LIMIT 10
```

**reStructuredText (RST):**
```sql
# Description: What this query does
# Timeout: 30s
# Connection: my-cluster
SELECT * FROM logs LIMIT 10
```

**Note:** RST uses `#` for comments while markdown uses `--`.

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

You can override connection settings within markdown and RST documents using configuration blocks. This is perfect for working with multiple clusters or different authentication methods in a single document.

### Configuration Block Syntax

Create configuration blocks using `config`, `opensearch-config`, or `connection` language identifiers:

**Markdown:**
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

**reStructuredText (RST):**
````rst
.. code-block:: config

   @endpoint = 'http://localhost:9200'
   @auth_type = 'none'
   @timeout = '30s'

.. code-block:: sql

   # This query uses the configuration above
   SELECT * FROM my_index LIMIT 10
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

**Markdown:**
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

**reStructuredText (RST):**
````rst
Development Environment
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: config

   @endpoint = 'http://localhost:9200'
   @auth_type = 'none'

.. code-block:: sql

   # Query development cluster
   SELECT COUNT(*) FROM dev_logs

Production Environment
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: config

   @endpoint = 'https://prod-cluster:9200'
   @auth_type = 'basic'
   @username = 'readonly'
   @password = 'secure_password'
   @timeout = '60s'

.. code-block:: sql

   # Query production cluster with extended timeout
   SELECT COUNT(*) FROM prod_logs WHERE timestamp > NOW() - INTERVAL 1 DAY
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

## Supported File Types

- **Markdown** (`.md`) - Traditional markdown syntax with ` ``` ` code blocks
- **reStructuredText** (`.rst`) - RST syntax with `.. code-block::` directives
- Both formats support the same query types and features
- Comments use `--` in markdown and `#` in RST files

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
- **reStructuredText (RST) support** - Full support for `.rst` files with `.. code-block::` syntax
- **Dual format support** - Both markdown (`.md`) and RST (`.rst`) files supported
- OpenSearch REST API support with HTTP request line format (`GET /index/_search`)
- Backwards compatible metadata comment format (`-- Method: GET` for markdown, `# Method: GET` for RST)
- Inline and separate tab result display
- Query history management
- CodeLens integration
- Authentication support (none, basic, API key)
- Per-document configuration blocks with `@variable = 'value'` syntax
- Multi-cluster support with cascade behavior
- Configuration validation and error handling
- Flexible format mixing (HTTP request line + metadata comments)
- **Comment syntax adaptation** - Automatic handling of `--` comments in markdown and `#` comments in RST

## Developer Guide

This section provides comprehensive information for developers working on the OpenSearch Query Runner extension.

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ykmr1224/opensearch-query-runner.git
   cd opensearch-query-runner
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Compile TypeScript**:
   ```bash
   npm run compile
   ```

### Development Scripts

The project includes several npm scripts for different development tasks:

| Script | Command | Description |
|--------|---------|-------------|
| **Compilation** | `npm run compile` | Compile TypeScript to JavaScript |
| | `npm run watch` | Watch mode compilation |
| **Testing** | `npm run test` | Run automated unit tests |
| | `npm run test:coverage` | Run tests with coverage report |
| | `npm run manual-test` | Launch interactive testing environment (dark purple theme) |
| | `npm run manual-test:light` | Launch interactive testing environment (light purple theme) |
| **Development** | `npm run dev` | Compile + reinstall extension |
| | `npm run reinstall` | Package + uninstall + install extension |
| **Quality** | `npm run lint` | Run ESLint |
| | `npm run pretest` | Compile + lint (runs before tests) |
| **Packaging** | `npm run package` | Create .vsix package |
| | `npm run build` | Full build pipeline |
| **Cleanup** | `npm run clean` | Remove build artifacts |

### Development Workflow

#### 1. Standard Development Cycle

```bash
# Make code changes
# Compile and reinstall in your main VSCode
npm run dev

# Test the changes in your main VSCode instance
# Repeat as needed
```

#### 2. Interactive Testing Workflow

For comprehensive testing with the demo environment:

```bash
# Make code changes
# Compile the extension
npm run compile

# Launch manual test environment
npm run manual-test
```

This opens a clean VSCode window with:
- Your extension loaded in development mode
- `demo.md` automatically opened with test examples
- All extension features ready for interactive testing
- Window stays open until you manually close it

#### 3. Test-Driven Development

```bash
# Write or update tests
# Run tests to verify they fail (red)
npm run test

# Implement the feature
# Run tests to verify they pass (green)
npm run test

# Refactor if needed
# Run tests to ensure they still pass
npm run test
```

### Manual Testing Environment

The manual testing environment (`npm run manual-test`) is perfect for:

- **Interactive Testing**: Click CodeLens buttons, test UI interactions
- **Visual Verification**: See actual rendering and behavior
- **Edge Case Testing**: Test scenarios not covered by unit tests
- **Debugging**: Step through code with real user interactions
- **Feature Validation**: Verify complete user workflows

**What it provides:**
- Clean VSCode instance with minimal extensions
- Your extension loaded in development mode
- `demo.md` pre-opened with comprehensive test examples
- Full workspace context for proper extension behavior
- Console output with helpful testing guidance

**Usage tips:**
- Use after making code changes to verify behavior
- Test all query types: SQL, PPL, REST API
- Verify CodeLens functionality and result display
- Test configuration blocks and authentication
- Check query history and error handling

### Testing Strategy

The project uses a multi-layered testing approach:

#### 1. Unit Tests (`npm run test`)
- **Location**: `src/test/*.test.ts`
- **Purpose**: Test individual functions and components
- **Coverage**: Core logic, parsing, validation, formatting
- **Run**: Automatically in CI/CD and before releases

#### 2. Integration Tests
- **Included in**: Unit test suite
- **Purpose**: Test component interactions
- **Coverage**: End-to-end workflows, API integration
- **Examples**: Query parsing → execution → result formatting

#### 3. Manual Testing (`npm run manual-test`)
- **Purpose**: Interactive testing and validation
- **Coverage**: UI behavior, user workflows, edge cases
- **When**: After significant changes, before releases
- **Benefits**: Catches issues automated tests might miss

#### 4. Test Coverage
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
npm run coverage:open
```

### Extension Architecture

#### Key Components

1. **Extension Entry Point** (`src/extension.ts`)
   - Extension activation and deactivation
   - Command registration and initialization
   - Provider setup and configuration

2. **CodeLens Provider** (`src/codeLensProvider.ts`)
   - Detects query blocks in markdown files
   - Provides "Run Query" buttons above code blocks
   - Handles different query types (SQL, PPL, REST API)

3. **Query Execution** (`src/queryRunner.ts`)
   - Orchestrates query execution workflow
   - Handles different display modes (inline vs separate tab)
   - Manages error handling and user feedback

4. **Connection Management** (`src/connectionManager.ts`)
   - Manages OpenSearch cluster connections
   - Handles authentication (none, basic, API key)
   - Configuration validation and error handling

5. **History Management** (`src/historyManager.ts`)
   - Tracks query execution history
   - Provides history UI in separate tab mode
   - Manages history persistence and cleanup

6. **Parsing and Validation** (`src/markdownParser.ts`, `src/utils/`)
   - Parses markdown files for query blocks
   - Validates query syntax and configuration
   - Handles per-document configuration blocks

#### Extension Lifecycle

1. **Activation**: When markdown files are opened
2. **CodeLens Detection**: Scans for query blocks
3. **User Interaction**: User clicks "Run Query"
4. **Configuration Resolution**: Applies document/global config
5. **Query Execution**: Sends request to OpenSearch
6. **Result Display**: Shows results inline or in separate tab
7. **History Tracking**: Records query for future reference

### Code Style and Standards

#### TypeScript Configuration
- **Target**: ES2020
- **Module**: CommonJS
- **Strict mode**: Enabled
- **Source maps**: Generated for debugging

#### ESLint Rules
- **Base**: `@typescript-eslint/recommended`
- **Style**: Consistent formatting and naming
- **Imports**: Organized and validated
- **Run**: `npm run lint`

#### File Organization
```
src/
├── extension.ts              # Main extension entry point
├── codeLensProvider.ts       # CodeLens functionality
├── queryRunner.ts           # Query execution orchestration
├── connectionManager.ts     # OpenSearch connection handling
├── historyManager.ts        # Query history management
├── markdownParser.ts        # Markdown parsing logic
├── resultsProvider.ts       # Results display management
├── types.ts                 # TypeScript type definitions
├── test/                    # Test files
│   ├── *.test.ts           # Unit tests
│   ├── runTest.ts          # Automated test runner
│   ├── runManualTest.ts    # Manual test environment
│   └── suite/              # Test suite configuration
└── utils/                   # Utility functions
    ├── errorHandler.ts      # Error handling utilities
    ├── httpFormatter.ts     # HTTP request formatting
    ├── queryExecutor.ts     # Low-level query execution
    └── ...                  # Other utilities
```

### Debugging

#### VSCode Debugging

**Method 1: Using F5 (Quick Debug)**
1. **Open the project** in VSCode
2. **Set breakpoints** in TypeScript files
3. **Press F5** or use Run → Start Debugging
   - This will automatically compile the extension first
   - A new VSCode window opens with your extension loaded

**Method 2: Using Debug Panel (Recommended)**
1. **Open Debug Panel** (Ctrl+Shift+D or View → Run)
2. **Select debug configuration** from dropdown:
   - **"Run Extension"**: Basic extension debugging
   - **"Run Extension with Demo"**: Opens with demo.md file
   - **"Extension Tests"**: Run tests with debugging
3. **Click the green play button** or press F5
4. **Extension Development Host opens** with your extension loaded

**Method 3: Manual Extension Development Host**
If debugging doesn't work automatically:
1. **Compile first**: `npm run compile`
2. **Open Command Palette** (Ctrl+Shift+P)
3. **Run**: "Developer: Reload Window" to ensure clean state
4. **Use terminal command**: `code --extensionDevelopmentPath=. opensearch-query-runner.code-workspace`
5. **Or Command Palette** → "Extensions: Install from VSIX..." for installed extension testing

**Debugging Experience:**
- **New VSCode window** opens (Extension Development Host)
- **Your extension is loaded** and active
- **Set breakpoints** in original window, they work in Extension Development Host
- **Test extension features** in the new window
- **Console output** available in Developer Tools

**Available Debug Configurations:**
- **Run Extension**: Basic extension debugging (dark purple theme)
- **Run Extension with Demo**: Opens with demo.md pre-loaded (dark purple theme)
- **Run Extension (Light Theme)**: Basic extension debugging (light purple theme)
- **Extension Tests**: Run automated tests with debugging (dark purple theme)

**VSCode Configuration Files:**
- `.vscode/launch.json`: Debug configurations (uses workspace file)
- `.vscode/tasks.json`: Build and test tasks (npm scripts)
- `opensearch-query-runner.code-workspace`: Workspace definition with dark purple theme
- Tasks include: compile, watch, test, manual-test

**Theme Options:**

**Dark Purple Theme** (default):
- Deep purple activity bar (#4A148C) and title bar (#6A1B9A)
- Dark purple editor background (#0D0221)
- Purple-themed tabs, sidebar, and panels
- Light purple text for good contrast
- Perfect for developers who prefer dark themes

**Light Purple Theme** (alternative):
- Light purple activity bar (#E1BEE7) and title bar (#F3E5F5)
- Clean white editor background (#FEFEFE)
- Light purple-themed tabs, sidebar, and panels
- Dark purple text for excellent readability
- Perfect for developers who prefer light themes

Both themes provide clear visual distinction from your main VSCode instance while maintaining professional appearance and excellent readability.

**Troubleshooting Debugging:**
- **Nothing happens on F5**: Check Debug Panel, select "Run Extension" configuration
- **Extension not loading**: Ensure `npm run compile` completed successfully
- **Breakpoints not working**: Check that source maps are enabled and files compiled
- **Wrong directory opens**: All configurations now use workspace file for proper project opening
- **Still opens wrong directory**: Try manual command: `code --extensionDevelopmentPath=. opensearch-query-runner.code-workspace`

#### Console Debugging
- Use `console.log()` for development debugging
- Check **Developer Tools** → **Console** in Extension Development Host
- Use **Output Panel** → **OpenSearch Query Runner** for extension logs

#### Manual Test Environment Debugging
```bash
# Launch with console output
npm run manual-test

# Check terminal for extension logs:
# "OpenSearch Query Runner extension is now active!"
# "Manual test environment started"
# "demo.md opened successfully!"
```

### Release Process

#### Version Management
1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with new features/fixes
3. **Run full test suite**: `npm run test:coverage`
4. **Test manually**: `npm run manual-test`
5. **Build package**: `npm run package`

#### Quality Checklist
- [ ] All tests pass (`npm run test`)
- [ ] Code coverage acceptable (`npm run test:coverage`)
- [ ] Manual testing completed (`npm run manual-test`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Extension packages successfully (`npm run package`)
- [ ] Installation works (`npm run reinstall`)

#### CI/CD Pipeline
The project includes scripts for continuous integration:
```bash
# CI build command
npm run build:ci
# Runs: compile + lint + test:coverage
```

### Extension Reload Requirements

When developing VSCode extensions, code changes require the extension to be reloaded:

1. **After code changes**: Extension must be reloaded or reinstalled
2. **Simple reload may not work**: Sometimes full uninstall/reinstall required
3. **Recommended workflow**:
   - Make code changes
   - Run `npm run dev` (compiles + reinstalls)
   - Test changes in VSCode
   - Repeat as needed

### Troubleshooting Development Issues

#### Common Issues

**Extension not loading after changes**:
```bash
# Solution: Full reinstall
npm run dev
```

**Tests failing unexpectedly**:
```bash
# Clean and rebuild
npm run clean
npm run compile
npm run test
```

**Manual test environment not working**:
```bash
# Ensure compilation first
npm run compile
npm run manual-test
```

**TypeScript compilation errors**:
```bash
# Check TypeScript configuration
npx tsc --noEmit
npm run compile
```

#### Debug Output Locations
- **Extension Console**: Developer Tools → Console (in Extension Development Host)
- **Output Panel**: View → Output → "OpenSearch Query Runner"
- **Terminal**: npm script output and error messages
- **Test Results**: Terminal output from `npm run test`

### Contributing Guidelines

#### Before Contributing
1. **Read this developer guide** thoroughly
2. **Set up development environment** as described above
3. **Run existing tests** to ensure setup works
4. **Try manual testing** to understand the extension

#### Making Changes
1. **Create feature branch** from main
2. **Write tests** for new functionality
3. **Implement changes** following existing patterns
4. **Test thoroughly** (unit + manual testing)
5. **Update documentation** if needed
6. **Submit pull request** with clear description

#### Code Review Process
- All changes require review
- Tests must pass
- Code coverage should not decrease significantly
- Manual testing verification may be requested

## Contributing

This extension is open source and contributions are welcome! Please see the Developer Guide above for detailed information on setting up your development environment and contributing to the project.

## License

MIT License - see LICENSE file for details.

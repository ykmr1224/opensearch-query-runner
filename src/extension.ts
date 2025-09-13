import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { QueryRunner } from './queryRunner';
import { ResultsProvider } from './resultsProvider';
import { HistoryManager } from './historyManager';
import { MarkdownParser } from './markdownParser';
import { OpenSearchCodeLensProvider, OpenSearchCodeActionProvider, OpenSearchHoverProvider } from './codeLensProvider';
import { DisplayMode } from './types';

let connectionManager: ConnectionManager;
let queryRunner: QueryRunner;
let resultsProvider: ResultsProvider;
let historyManager: HistoryManager;
let codeLensProvider: OpenSearchCodeLensProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenSearch Query Runner extension is now active!');

    // Initialize core components
    connectionManager = new ConnectionManager();
    queryRunner = new QueryRunner(connectionManager);
    historyManager = new HistoryManager(context);
    resultsProvider = new ResultsProvider(historyManager);
    codeLensProvider = new OpenSearchCodeLensProvider();

    // Register CodeLens provider
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { language: 'markdown' },
        codeLensProvider
    );

    // Register Code Action provider
    const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
        { language: 'markdown' },
        new OpenSearchCodeActionProvider()
    );

    // Register Hover provider
    const hoverDisposable = vscode.languages.registerHoverProvider(
        { language: 'markdown' },
        new OpenSearchHoverProvider()
    );

    // Register commands
    const runQueryCommand = vscode.commands.registerCommand(
        'opensearch-query.runQuery',
        async (uri?: vscode.Uri, position?: vscode.Position) => {
            await runQuery(uri, position);
        }
    );

    const runQueryInlineCommand = vscode.commands.registerCommand(
        'opensearch-query.runQueryInline',
        async (uri?: vscode.Uri, position?: vscode.Position) => {
            await runQuery(uri, position, DisplayMode.Inline);
        }
    );

    const runQueryInTabCommand = vscode.commands.registerCommand(
        'opensearch-query.runQueryInTab',
        async (uri?: vscode.Uri, position?: vscode.Position) => {
            await runQuery(uri, position, DisplayMode.SeparateTab);
        }
    );

    const showHistoryCommand = vscode.commands.registerCommand(
        'opensearch-query.showHistory',
        async () => {
            await historyManager.showHistoryPanel();
        }
    );

    const configureConnectionCommand = vscode.commands.registerCommand(
        'opensearch-query.configureConnection',
        async () => {
            await connectionManager.configureConnection();
        }
    );

    const formatQueryCommand = vscode.commands.registerCommand(
        'opensearch-query.formatQuery',
        async (uri?: vscode.Uri, position?: vscode.Position) => {
            await formatQuery(uri, position);
        }
    );

    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'opensearch-query.configureConnection';
    statusBarItem.text = '$(database) OpenSearch';
    statusBarItem.tooltip = 'Configure OpenSearch connection';
    statusBarItem.show();

    // Update status bar based on connection
    updateStatusBar(statusBarItem);

    // Listen for configuration changes to update status bar
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('opensearch')) {
            updateStatusBar(statusBarItem);
            codeLensProvider.refresh();
        }
    });

    // Add all disposables to context
    context.subscriptions.push(
        codeLensDisposable,
        codeActionDisposable,
        hoverDisposable,
        runQueryCommand,
        runQueryInlineCommand,
        runQueryInTabCommand,
        showHistoryCommand,
        configureConnectionCommand,
        formatQueryCommand,
        statusBarItem,
        configChangeDisposable
    );

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('opensearch.hasShownWelcome', false);
    if (!hasShownWelcome) {
        showWelcomeMessage(context);
    }
}

async function runQuery(
    uri?: vscode.Uri,
    position?: vscode.Position,
    displayMode?: DisplayMode
): Promise<void> {
    try {
        // Get active editor and document
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('OpenSearch queries can only be run from markdown files');
            return;
        }

        // Use provided position or cursor position
        const queryPosition = position || editor.selection.active;

        // Find query block at position with configuration overrides
        const queryBlock = MarkdownParser.findQueryBlockAtPositionWithOverrides(document, queryPosition);
        if (!queryBlock) {
            vscode.window.showWarningMessage('No query block found at cursor position');
            return;
        }

        // Check connection configuration
        const config = connectionManager.getConfig();
        if (!config || !config.endpoint) {
            const choice = await vscode.window.showWarningMessage(
                'OpenSearch connection not configured',
                'Configure Now',
                'Cancel'
            );
            if (choice === 'Configure Now') {
                await connectionManager.configureConnection();
                return;
            }
            return;
        }

        // Determine display mode
        let mode = displayMode;
        if (!mode) {
            mode = await queryRunner.promptForDisplayMode();
            if (!mode) {
                return; // User cancelled
            }
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Executing OpenSearch query...',
            cancellable: false
        }, async (progress) => {
            // Execute query
            const result = await queryRunner.executeQueryFromBlock(queryBlock);

            // For SQL and PPL queries, also execute explain query if in separate tab mode
            if (mode === DisplayMode.SeparateTab && (queryBlock.type === 'sql' || queryBlock.type === 'ppl')) {
                progress.report({ message: 'Executing explain query...' });
                const explainResult = await queryRunner.executeExplainQueryFromBlock(queryBlock);
                
                // Add to history if separate tab mode (including explain result)
                await historyManager.addToHistory(
                    queryBlock.content,
                    queryBlock.type,
                    result,
                    config!.endpoint,
                    explainResult
                );

                // Display results with explain
                await resultsProvider.displayResultsWithExplain(
                    result,
                    explainResult,
                    mode!,
                    queryBlock.content,
                    queryBlock.type,
                    document,
                    queryPosition
                );
            } else {
                // Add to history if separate tab mode
                if (mode === DisplayMode.SeparateTab) {
                    await historyManager.addToHistory(
                        queryBlock.content,
                        queryBlock.type,
                        result,
                        config!.endpoint
                    );
                }

                // Display results without explain
                await resultsProvider.displayResults(
                    result,
                    mode!,
                    queryBlock.content,
                    queryBlock.type,
                    document,
                    queryPosition
                );
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to execute query: ${error.message}`);
        console.error('Query execution error:', error);
    }
}

async function formatQuery(uri?: vscode.Uri, position?: vscode.Position): Promise<void> {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const queryPosition = position || editor.selection.active;

        const queryBlock = MarkdownParser.findQueryBlockAtPosition(document, queryPosition);
        if (!queryBlock) {
            vscode.window.showWarningMessage('No query block found at cursor position');
            return;
        }

        // Format the query
        const formattedQuery = MarkdownParser.formatQuery(queryBlock.content, queryBlock.type);

        // Replace the query content
        const queryStart = new vscode.Position(queryBlock.range.start.line + 1, 0);
        const queryEnd = new vscode.Position(queryBlock.range.end.line - 1, 0);
        const queryRange = new vscode.Range(queryStart, queryEnd);

        await editor.edit(editBuilder => {
            editBuilder.replace(queryRange, formattedQuery);
        });

        vscode.window.showInformationMessage('Query formatted successfully');

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to format query: ${error.message}`);
    }
}

async function updateStatusBar(statusBarItem: vscode.StatusBarItem): Promise<void> {
    try {
        const testResult = await connectionManager.testConnection();
        
        if (testResult.success) {
            statusBarItem.text = '$(database) OpenSearch ✓';
            statusBarItem.tooltip = `Connected to OpenSearch cluster: ${testResult.clusterName}`;
            statusBarItem.backgroundColor = undefined;
        } else {
            statusBarItem.text = '$(database) OpenSearch ✗';
            statusBarItem.tooltip = `OpenSearch connection failed: ${testResult.error}`;
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    } catch (error) {
        statusBarItem.text = '$(database) OpenSearch ?';
        statusBarItem.tooltip = 'OpenSearch connection status unknown';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

async function showWelcomeMessage(context: vscode.ExtensionContext): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
        'Welcome to OpenSearch Query Runner! Would you like to configure your OpenSearch connection now?',
        'Configure Connection',
        'Show Example',
        'Later'
    );

    switch (choice) {
        case 'Configure Connection':
            await connectionManager.configureConnection();
            break;
        case 'Show Example':
            await showExampleDocument();
            break;
    }

    await context.globalState.update('opensearch.hasShownWelcome', true);
}

async function showExampleDocument(): Promise<void> {
    const exampleContent = `# OpenSearch Query Examples

This document shows examples of SQL, PPL, and OpenSearch API operations that can be executed against OpenSearch.

## SQL Query Example

\`\`\`sql
-- Description: Get recent log entries
-- Timeout: 30s
SELECT timestamp, level, message 
FROM logs 
WHERE timestamp > '2023-01-01' 
ORDER BY timestamp DESC 
LIMIT 10
\`\`\`

## PPL Query Example

\`\`\`ppl
-- Description: Analyze log levels
-- Timeout: 15s
source=logs 
| where timestamp > '2023-01-01' 
| stats count() by level 
| sort count desc
\`\`\`

## OpenSearch API Example

\`\`\`opensearch-api
-- Description: Create a new index with mappings
PUT /logs-2024
{
  "mappings": {
    "properties": {
      "timestamp": { "type": "date" },
      "level": { "type": "keyword" },
      "message": { "type": "text" }
    }
  }
}
\`\`\`

\`\`\`opensearch-api
-- Description: Index a document
POST /logs-2024/_doc
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "Application started successfully"
}
\`\`\`

## How to Use

1. **Configure Connection**: Click the OpenSearch status bar item or use Command Palette → "OpenSearch: Configure Connection"
2. **Run Operations**: Click the "Run Query" CodeLens above any query block or API operation
3. **Choose Display Mode**: Select "Inline" to show results in this document, or "Separate Tab" for a dedicated results view
4. **View History**: Use Command Palette → "OpenSearch: Show Query History" to see previous queries

## Query Types

- **SQL**: Traditional SQL queries using OpenSearch SQL plugin
- **PPL**: Piped Processing Language for log analysis
- **OpenSearch API**: Direct REST API operations for index management, data insertion, and advanced operations

## Query Metadata

You can add metadata to your queries using comments:

- \`-- Connection: cluster-name\` - Specify connection (future feature)
- \`-- Timeout: 30s\` - Set query timeout
- \`-- Description: What this query does\` - Add description
- \`-- Method: POST\` - HTTP method for API operations
- \`-- Endpoint: /index/_doc\` - API endpoint for operations

Happy querying! 🚀
`;

    const doc = await vscode.workspace.openTextDocument({
        content: exampleContent,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}

export function deactivate() {
    console.log('OpenSearch Query Runner extension is now deactivated');
}

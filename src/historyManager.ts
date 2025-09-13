import * as vscode from 'vscode';
import { QueryHistoryItem, QueryResult, OpenSearchConfig } from './types';

export class HistoryManager {
    private history: QueryHistoryItem[] = [];
    private context: vscode.ExtensionContext;
    private maxHistoryItems: number = 100;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadHistory();
        this.updateMaxHistoryItems();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('opensearch.maxHistoryItems')) {
                this.updateMaxHistoryItems();
            }
        });
    }

    private updateMaxHistoryItems(): void {
        const config = vscode.workspace.getConfiguration('opensearch');
        this.maxHistoryItems = config.get('maxHistoryItems', 100);
        this.trimHistory();
    }

    private loadHistory(): void {
        const savedHistory = this.context.globalState.get<QueryHistoryItem[]>('opensearch.queryHistory', []);
        
        // Convert timestamp strings back to Date objects
        this.history = savedHistory.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
        }));
    }

    private async saveHistory(): Promise<void> {
        await this.context.globalState.update('opensearch.queryHistory', this.history);
    }

    public async addToHistory(
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        result: QueryResult,
        endpoint: string,
        explainResult?: QueryResult
    ): Promise<void> {
        const historyItem: QueryHistoryItem = {
            id: this.generateId(),
            query,
            queryType,
            timestamp: new Date(),
            result,
            endpoint,
            explainResult
        };

        // Add to beginning of history
        this.history.unshift(historyItem);
        
        // Trim history if needed
        this.trimHistory();
        
        // Save to persistent storage
        await this.saveHistory();
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private trimHistory(): void {
        if (this.history.length > this.maxHistoryItems) {
            this.history = this.history.slice(0, this.maxHistoryItems);
        }
    }

    public getHistory(): QueryHistoryItem[] {
        return [...this.history];
    }

    public getHistoryItem(id: string): QueryHistoryItem | undefined {
        return this.history.find(item => item.id === id);
    }

    public async clearHistory(): Promise<void> {
        this.history = [];
        await this.saveHistory();
    }

    public async removeHistoryItem(id: string): Promise<void> {
        this.history = this.history.filter(item => item.id !== id);
        await this.saveHistory();
    }

    public searchHistory(searchTerm: string): QueryHistoryItem[] {
        const term = searchTerm.toLowerCase();
        return this.history.filter(item => 
            item.query.toLowerCase().includes(term) ||
            item.queryType.toLowerCase().includes(term) ||
            item.endpoint.toLowerCase().includes(term)
        );
    }

    public getHistoryByType(queryType: 'sql' | 'ppl'): QueryHistoryItem[] {
        return this.history.filter(item => item.queryType === queryType);
    }

    public getRecentHistory(count: number = 10): QueryHistoryItem[] {
        return this.history.slice(0, count);
    }

    public async showHistoryPanel(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'opensearchHistory',
            'OpenSearch Query History',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = this.generateHistoryHtml();

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    switch (message.command) {
                        case 'rerun':
                            await this.rerunQuery(message.id);
                            break;
                        case 'delete':
                            await this.removeHistoryItem(message.id);
                            // Send updated data to webview instead of regenerating HTML
                            panel.webview.postMessage({
                                command: 'updateHistory',
                                data: this.getHistory()
                            });
                            break;
                        case 'clear':
                            await this.clearHistory();
                            // Send updated data to webview instead of regenerating HTML
                            panel.webview.postMessage({
                                command: 'updateHistory',
                                data: this.getHistory()
                            });
                            break;
                        case 'confirmDelete':
                            // Show confirmation dialog in VSCode
                            const deleteChoice = await vscode.window.showWarningMessage(
                                'Are you sure you want to delete this history item?',
                                { modal: true },
                                'Delete'
                            );
                            if (deleteChoice === 'Delete') {
                                await this.removeHistoryItem(message.id);
                                panel.webview.postMessage({
                                    command: 'updateHistory',
                                    data: this.getHistory()
                                });
                            }
                            break;
                        case 'confirmClear':
                            // Show confirmation dialog in VSCode
                            const clearChoice = await vscode.window.showWarningMessage(
                                'Are you sure you want to clear all history? This cannot be undone.',
                                { modal: true },
                                'Clear All'
                            );
                            if (clearChoice === 'Clear All') {
                                await this.clearHistory();
                                panel.webview.postMessage({
                                    command: 'updateHistory',
                                    data: this.getHistory()
                                });
                            }
                            break;
                        case 'export':
                            await this.exportHistory();
                            break;
                        case 'refresh':
                            // Handle explicit refresh requests
                            panel.webview.postMessage({
                                command: 'updateHistory',
                                data: this.getHistory()
                            });
                            break;
                    }
                } catch (error) {
                    console.error('Error handling webview message:', error);
                    vscode.window.showErrorMessage(`History operation failed: ${error}`);
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async rerunQuery(id: string): Promise<void> {
        const historyItem = this.getHistoryItem(id);
        if (!historyItem) {
            vscode.window.showErrorMessage('History item not found');
            return;
        }

        // Create a temporary markdown document with the query
        const query = historyItem.query;
        const queryType = historyItem.queryType;
        const content = `# Rerun Query\n\n\`\`\`${queryType}\n${query}\n\`\`\`\n`;

        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('Query loaded in new document. Use "Run Query" to execute.');
    }

    private generateHistoryHtml(): string {
        const historyItems = this.getHistory();
        
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <title>OpenSearch Query History</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .actions {
                    display: flex;
                    gap: 10px;
                }
                .btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .history-item {
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    margin-bottom: 15px;
                    padding: 15px;
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                }
                .history-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .query-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 0.8em;
                    font-weight: bold;
                }
                .timestamp {
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .query-preview {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 3px;
                    padding: 10px;
                    margin: 10px 0;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.9em;
                    white-space: pre-wrap;
                    overflow-x: auto;
                }
                .result-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 10px 0;
                    font-size: 0.9em;
                }
                .success {
                    color: var(--vscode-testing-iconPassed);
                }
                .error {
                    color: var(--vscode-testing-iconFailed);
                }
                .item-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 10px;
                }
                .btn-small {
                    padding: 4px 8px;
                    font-size: 0.8em;
                }
                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 50px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Query History (${historyItems.length} items)</h1>
                <div class="actions">
                    <button class="btn btn-secondary" onclick="exportHistory()">Export</button>
                    <button class="btn btn-secondary" onclick="clearHistory()">Clear All</button>
                </div>
            </div>

            <div id="history-container">
                ${historyItems.length === 0 ? this.generateEmptyState() : this.generateHistoryItems(historyItems)}
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateHistory':
                            updateHistoryDisplay(message.data);
                            break;
                    }
                });

                function updateHistoryDisplay(historyItems) {
                    // Update the header count
                    const header = document.querySelector('.header h1');
                    if (header) {
                        header.textContent = \`Query History (\${historyItems.length} items)\`;
                    }

                    // Get the history container by ID for reliable selection
                    const container = document.getElementById('history-container');
                    if (!container) {
                        console.error('History container not found');
                        return;
                    }
                    
                    if (historyItems.length === 0) {
                        container.innerHTML = \`
                            <div class="empty-state">
                                <h2>No query history yet</h2>
                                <p>Execute some queries to see them appear here.</p>
                            </div>
                        \`;
                    } else {
                        container.innerHTML = generateHistoryItemsHtml(historyItems);
                    }
                }

                function generateHistoryItemsHtml(items) {
                    return items.map(item => {
                        const queryPreview = item.query.length > 200 
                            ? item.query.substring(0, 200) + '...' 
                            : item.query;

                        const statusIcon = item.result.success ? '✅' : '❌';
                        const statusText = item.result.success 
                            ? \`Success (\${item.result.executionTime}ms\${item.result.rowCount !== undefined ? \`, \${item.result.rowCount} rows\` : ''})\`
                            : \`Error: \${item.result.error}\`;

                        const timestamp = new Date(item.timestamp).toLocaleString();

                        return \`
                            <div class="history-item">
                                <div class="history-header">
                                    <div>
                                        <span class="query-type">\${item.queryType.toUpperCase()}</span>
                                        <span class="timestamp">\${timestamp}</span>
                                    </div>
                                </div>
                                
                                <div class="query-preview">\${queryPreview}</div>
                                
                                <div class="result-status">
                                    <span class="\${item.result.success ? 'success' : 'error'}">\${statusIcon} \${statusText}</span>
                                </div>
                                
                                <div class="item-actions">
                                    <button class="btn btn-small" onclick="rerunQuery('\${item.id}')">Rerun</button>
                                    <button class="btn btn-small btn-secondary" onclick="deleteItem('\${item.id}')">Delete</button>
                                </div>
                            </div>
                        \`;
                    }).join('');
                }

                function rerunQuery(id) {
                    vscode.postMessage({
                        command: 'rerun',
                        id: id
                    });
                }

                function deleteItem(id) {
                    // Send confirmation request to extension instead of using blocked confirm()
                    vscode.postMessage({
                        command: 'confirmDelete',
                        id: id
                    });
                }

                function clearHistory() {
                    // Send confirmation request to extension instead of using blocked confirm()
                    vscode.postMessage({
                        command: 'confirmClear'
                    });
                }

                function exportHistory() {
                    vscode.postMessage({
                        command: 'export'
                    });
                }
            </script>
        </body>
        </html>
        `;
    }

    private generateEmptyState(): string {
        return `
            <div class="empty-state">
                <h2>No query history yet</h2>
                <p>Execute some queries to see them appear here.</p>
            </div>
        `;
    }

    private generateHistoryItems(items: QueryHistoryItem[]): string {
        return items.map(item => {
            const queryPreview = item.query.length > 200 
                ? item.query.substring(0, 200) + '...' 
                : item.query;

            const statusIcon = item.result.success ? '✅' : '❌';
            const statusText = item.result.success 
                ? `Success (${item.result.executionTime}ms${item.result.rowCount !== undefined ? `, ${item.result.rowCount} rows` : ''})`
                : `Error: ${item.result.error}`;

            return `
                <div class="history-item">
                    <div class="history-header">
                        <div>
                            <span class="query-type">${item.queryType.toUpperCase()}</span>
                            <span class="timestamp">${item.timestamp.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="query-preview">${queryPreview}</div>
                    
                    <div class="result-status">
                        <span class="${item.result.success ? 'success' : 'error'}">${statusIcon} ${statusText}</span>
                    </div>
                    
                    <div class="item-actions">
                        <button class="btn btn-small" onclick="rerunQuery('${item.id}')">Rerun</button>
                        <button class="btn btn-small btn-secondary" onclick="deleteItem('${item.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    private async exportHistory(): Promise<void> {
        const history = this.getHistory();
        
        if (history.length === 0) {
            vscode.window.showInformationMessage('No history to export');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            totalItems: history.length,
            items: history.map(item => ({
                id: item.id,
                query: item.query,
                queryType: item.queryType,
                timestamp: item.timestamp.toISOString(),
                endpoint: item.endpoint,
                result: {
                    success: item.result.success,
                    executionTime: item.result.executionTime,
                    rowCount: item.result.rowCount,
                    error: item.result.error
                }
            }))
        };

        const content = JSON.stringify(exportData, null, 2);
        
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'json'
        });

        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('History exported to new document');
    }

    public getStatistics(): {
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        sqlQueries: number;
        pplQueries: number;
        averageExecutionTime: number;
    } {
        const total = this.history.length;
        const successful = this.history.filter(item => item.result.success).length;
        const failed = total - successful;
        const sql = this.history.filter(item => item.queryType === 'sql').length;
        const ppl = this.history.filter(item => item.queryType === 'ppl').length;
        
        const executionTimes = this.history
            .filter(item => item.result.success)
            .map(item => item.result.executionTime);
        
        const averageExecutionTime = executionTimes.length > 0 
            ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
            : 0;

        return {
            totalQueries: total,
            successfulQueries: successful,
            failedQueries: failed,
            sqlQueries: sql,
            pplQueries: ppl,
            averageExecutionTime: Math.round(averageExecutionTime)
        };
    }
}

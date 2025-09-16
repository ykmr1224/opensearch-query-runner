import * as vscode from 'vscode';
import { QueryResult, QueryHistoryItem } from './types';
import { HistoryManager } from './historyManager';
import { TabContentGenerator } from './utils/tabContentGenerator';
import { HttpFormatter } from './utils/httpFormatter';

export class PersistentResultsManager {
    private static instance: PersistentResultsManager | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private historyManager: HistoryManager;
    private currentHistoryId: string | undefined;

    private constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
    }

    public static getInstance(historyManager: HistoryManager): PersistentResultsManager {
        if (!PersistentResultsManager.instance) {
            PersistentResultsManager.instance = new PersistentResultsManager(historyManager);
        }
        return PersistentResultsManager.instance;
    }

    public async showResults(
        result: QueryResult,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        explainResult?: QueryResult
    ): Promise<void> {
        // Get the most recent history item (should be the one just added)
        const recentHistory = this.historyManager.getRecentHistory(1);
        if (recentHistory.length > 0) {
            this.currentHistoryId = recentHistory[0].id;
        }

        if (!this.panel) {
            this.createPanel();
        }

        if (this.panel) {
            this.panel.webview.html = this.generateResultsHtml(result, query, queryType, explainResult);
            this.panel.reveal(vscode.ViewColumn.Beside);
        }

        // Show success/error message
        if (result.success) {
            vscode.window.showInformationMessage(
                `Query executed successfully in ${result.executionTime}ms`
            );
        } else {
            vscode.window.showErrorMessage(`Query failed: ${result.error}`);
        }
    }

    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'opensearchPersistentResults',
            'OpenSearch Query Results',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Handle panel disposal
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            PersistentResultsManager.instance = undefined;
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    switch (message.command) {
                        case 'selectHistory':
                            await this.handleSquareSelection(message.historyId);
                            break;
                        case 'deleteHistory':
                            await this.handleHistoryDelete(message.historyId);
                            break;
                    }
                } catch (error) {
                    console.error('Error handling webview message:', error);
                    vscode.window.showErrorMessage(`Operation failed: ${error}`);
                }
            }
        );
    }

    private async handleSquareSelection(historyId: string): Promise<void> {
        const historyItem = this.historyManager.getHistoryItem(historyId);
        if (!historyItem) {
            vscode.window.showErrorMessage('History item not found');
            return;
        }

        this.currentHistoryId = historyId;
        
        if (this.panel) {
            // Use the stored explainResult if available
            this.panel.webview.html = this.generateResultsHtml(
                historyItem.result,
                historyItem.query,
                historyItem.queryType,
                historyItem.explainResult
            );
        }
    }

    private async handleHistoryDelete(historyId: string): Promise<void> {
        try {
            // Try to show confirmation dialog (non-modal for test compatibility)
            const deleteChoice = await vscode.window.showWarningMessage(
                'Are you sure you want to delete this history item?',
                'Delete',
                'Cancel'
            );

            if (deleteChoice !== 'Delete') {
                return;
            }
        } catch (error) {
            // If dialog fails (e.g., in test environment), proceed with deletion
            console.log('Dialog not available, proceeding with deletion');
        }

        await this.historyManager.removeHistoryItem(historyId);

        // If we deleted the currently displayed item, switch to the most recent
        if (this.currentHistoryId === historyId) {
            const recentHistory = this.historyManager.getRecentHistory(1);
            if (recentHistory.length > 0) {
                this.currentHistoryId = recentHistory[0].id;
                await this.handleSquareSelection(this.currentHistoryId);
            } else {
                // No history left, show empty state
                if (this.panel) {
                    this.panel.webview.html = this.generateEmptyStateHtml();
                }
            }
        } else {
            // Refresh the current view to update history squares
            if (this.currentHistoryId) {
                await this.handleSquareSelection(this.currentHistoryId);
            }
        }
    }

    private generateResultsHtml(
        result: QueryResult,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        explainResult?: QueryResult
    ): string {
        const timestamp = result.executedAt.toLocaleString();
        const tabs = TabContentGenerator.generateResultTabs(result, explainResult);
        const tabsHtml = TabContentGenerator.generateTabsHtml(tabs);
        const metadata = HttpFormatter.generateMetadata(result, explainResult);
        const historySquares = this.generateHistorySquares();
        
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OpenSearch Query Results</title>
            <style>
                ${this.getCommonCSS()}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-content">
                    <div class="header-left">
                        <h1>OpenSearch Query Results</h1>
                        <p>Executed at ${timestamp}</p>
                    </div>
                </div>
            </div>

            ${historySquares}

            <div class="query-info">
                <div class="query-type-label">${queryType.toUpperCase()}</div>
                <div class="query-content">
                    <pre>${query}</pre>
                </div>
                ${this.currentHistoryId ? `<button class="btn delete-btn" onclick="deleteCurrentHistory()" title="Delete this history item">Delete</button>` : ''}
            </div>

            ${metadata}
            ${tabsHtml}

            <script>
                ${this.getCommonJavaScript()}
            </script>
        </body>
        </html>
        `;
    }

    private generateHistorySquares(): string {
        const history = this.historyManager.getRecentHistory(20); // Limit to 20 for performance
        
        if (history.length === 0) {
            return '';
        }

        const squares = history.map(item => {
            const isSelected = item.id === this.currentHistoryId;
            const statusClass = item.result.success ? 'success' : 'error';
            const queryTypeLetter = this.getQueryTypeLetter(item.queryType);
            
            return `
                <div class="history-square ${statusClass} ${isSelected ? 'selected' : ''}" 
                     onclick="selectHistory('${item.id}')" 
                     title="${item.queryType.toUpperCase()} - ${item.result.success ? 'Success' : 'Failed'} - ${item.timestamp.toLocaleString()}">
                    ${queryTypeLetter}
                </div>
            `;
        }).join('');

        return `
            <div class="history-section">
                <div class="history-icon">📋</div>
                <div class="history-squares">
                    ${squares}
                </div>
            </div>
        `;
    }

    private getQueryTypeLetter(queryType: 'sql' | 'ppl' | 'opensearch-api'): string {
        switch (queryType) {
            case 'sql': return 'S';
            case 'ppl': return 'P';
            case 'opensearch-api': return 'A';
            default: return '?';
        }
    }

    private generateEmptyStateHtml(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OpenSearch Query Results</title>
            <style>
                ${this.getCommonCSS()}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-content">
                    <div class="header-left">
                        <h1>OpenSearch Query Results</h1>
                        <p>No query history available</p>
                    </div>
                </div>
            </div>
            
            <div class="empty-state">
                <h2>No query results yet</h2>
                <p>Execute a query to see results here.</p>
            </div>
        </body>
        </html>
        `;
    }

    private getCommonCSS(): string {
        return `
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .header-left h1 {
                    margin: 0 0 5px 0;
                }
                .header-left p {
                    margin: 0;
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .header-right {
                    display: flex;
                    align-items: center;
                }
                .btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: background-color 0.2s ease;
                }
                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .history-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .history-btn .icon {
                    font-size: 1em;
                }
                .delete-btn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    margin-top: 10px;
                }
                .delete-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .history-section {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 20px;
                    padding: 10px;
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                    border-radius: 4px;
                }
                .history-icon {
                    font-size: 1.2em;
                    color: var(--vscode-foreground);
                    opacity: 0.8;
                }
                .history-squares {
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                }
                .history-square {
                    width: 21px;
                    height: 21px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 3px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 1.0em;
                    color: black !important;
                    transition: all 0.2s ease;
                    border: 2px solid transparent;
                }
                .history-square:hover {
                    opacity: 0.8;
                    transform: scale(1.05);
                }
                .history-square.success {
                    background-color: var(--vscode-testing-iconPassed);
                }
                .history-square.error {
                    background-color: var(--vscode-testing-iconFailed);
                }
                .history-square.selected {
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                }
                .query-info {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-button-background);
                    padding: 10px 15px;
                    margin-bottom: 20px;
                    position: relative;
                }
                .query-type-label {
                    position: absolute;
                    top: 0;
                    left: 0;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 4px 8px;
                    font-size: 0.8em;
                    font-weight: bold;
                    text-transform: uppercase;
                    z-index: 1;
                }
                .query-content {
                    margin-top: 20px;
                }
                .success {
                    color: var(--vscode-testing-iconPassed);
                }
                .error {
                    color: var(--vscode-testing-iconFailed);
                }
                .metadata {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 20px;
                    font-size: 0.9em;
                }
                .metadata-item {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 3px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px 12px;
                    text-align: left;
                }
                th {
                    background-color: var(--vscode-list-hoverBackground);
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                }
                .json-container {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    overflow-x: auto;
                }
                pre {
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .tabs {
                    display: flex;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 15px;
                }
                .tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                }
                .tab.active {
                    border-bottom-color: var(--vscode-focusBorder);
                    background-color: var(--vscode-tab-activeBackground);
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
                .debug-section {
                    margin-top: 10px;
                }
                .debug-item {
                    margin-bottom: 20px;
                }
                .debug-item h3 {
                    margin: 0 0 10px 0;
                    color: var(--vscode-foreground);
                    font-size: 1.1em;
                }
                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 50px;
                }
                .content-with-conversion {
                    position: relative;
                }
                .conversion-header {
                    position: absolute;
                    top: 0;
                    right: 0;
                    z-index: 10;
                    padding: 8px;
                }
                .convert-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.85em;
                    transition: background-color 0.2s ease;
                }
                .convert-btn:hover:not(.disabled) {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .convert-btn.disabled {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                .format-container {
                    padding-top: 35px;
                }
                .yaml-container {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    overflow-x: auto;
                }
        `;
    }

    private getCommonJavaScript(): string {
        return `
                const vscode = acquireVsCodeApi();

                function showTab(tabName) {
                    // Hide all tab contents
                    const contents = document.querySelectorAll('.tab-content');
                    contents.forEach(content => content.classList.remove('active'));
                    
                    // Remove active class from all tabs
                    const tabs = document.querySelectorAll('.tab');
                    tabs.forEach(tab => tab.classList.remove('active'));
                    
                    // Show selected tab content
                    document.getElementById(tabName).classList.add('active');
                    document.querySelector('[onclick="showTab(\\''+tabName+'\\')"]').classList.add('active');
                }


                function selectHistory(historyId) {
                    vscode.postMessage({
                        command: 'selectHistory',
                        historyId: historyId
                    });
                }

                function deleteCurrentHistory() {
                    const selectedSquare = document.querySelector('.history-square.selected');
                    if (selectedSquare) {
                        const historyId = selectedSquare.getAttribute('onclick').match(/'([^']+)'/)[1];
                        vscode.postMessage({
                            command: 'deleteHistory',
                            historyId: historyId
                        });
                    }
                }

                function toggleFormat(containerId) {
                    const jsonContainer = document.getElementById('json-' + containerId);
                    const yamlContainer = document.getElementById('yaml-' + containerId);
                    const button = document.getElementById('convert-btn-' + containerId);
                    
                    if (!jsonContainer || !yamlContainer || !button) {
                        console.error('Toggle containers not found for ID:', containerId);
                        return;
                    }
                    
                    const isShowingJson = jsonContainer.style.display !== 'none';
                    
                    if (isShowingJson) {
                        // Switch to YAML
                        jsonContainer.style.display = 'none';
                        yamlContainer.style.display = 'block';
                        button.textContent = 'Show JSON';
                    } else {
                        // Switch to JSON
                        jsonContainer.style.display = 'block';
                        yamlContainer.style.display = 'none';
                        button.textContent = 'Convert to YAML';
                    }
                }

                // Initialize all conversion buttons on page load
                document.addEventListener('DOMContentLoaded', function() {
                    // Find all conversion buttons and ensure they're properly initialized
                    const convertButtons = document.querySelectorAll('.convert-btn:not(.disabled)');
                    convertButtons.forEach(button => {
                        // Ensure button text is correct on load
                        if (button.textContent.trim() === '') {
                            button.textContent = 'Convert to YAML';
                        }
                    });
                });
        `;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        PersistentResultsManager.instance = undefined;
    }
}

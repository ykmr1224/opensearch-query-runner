import * as vscode from 'vscode';
import { QueryResult, QueryHistoryItem } from './types';
import { HistoryManager } from './historyManager';
import { TabContentGenerator } from './utils/tabContentGenerator';
import { HttpFormatter } from './utils/httpFormatter';
import { SvgIcons } from './utils/svgIcons';
import { TimestampFormatter } from './utils/timestampFormatter';
import { WebviewStyles } from './utils/webviewStyles';

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
        const timestamp = TimestampFormatter.formatLocal(result.executedAt);
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
                ${WebviewStyles.getCommonCSS()}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-content">
                    <div class="header-left">
                        <h1>OpenSearch Query Results</h1>
                    </div>
                </div>
            </div>

            ${historySquares}

            <div class="query-info">
                <div class="query-type-container">
                    ${this.currentHistoryId ? `<button class="delete-btn" onclick="deleteCurrentHistory()" title="Delete this history item">
                        ${SvgIcons.getTrashIcon(12, 12)}
                    </button>` : ''}
                    <div class="query-type-label">${queryType.toUpperCase()} @ ${timestamp}</div>
                </div>
                <div class="query-content">
                    <pre>${query}</pre>
                </div>
            </div>

            ${metadata}
            ${tabsHtml}

            <script>
                ${WebviewStyles.getCommonJavaScript()}
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
                <div class="history-icon">
                    ${SvgIcons.getHistoryIcon(20, 20)}
                </div>
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
                ${WebviewStyles.getCommonCSS()}
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

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        PersistentResultsManager.instance = undefined;
    }
}

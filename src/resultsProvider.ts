import * as vscode from 'vscode';
import { QueryResult, DisplayMode, QueryBlock } from './types';
import { QueryRunner } from './queryRunner';
import { HttpFormatter } from './utils/httpFormatter';
import { TabContentGenerator } from './utils/tabContentGenerator';

export class ResultsProvider {
    private static readonly RESULTS_START = '<!-- OpenSearch Results Start -->';
    private static readonly RESULTS_END = '<!-- OpenSearch Results End -->';

    public async displayResults(
        result: QueryResult,
        mode: DisplayMode,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        document?: vscode.TextDocument,
        position?: vscode.Position
    ): Promise<void> {
        if (mode === DisplayMode.Inline && document && position) {
            await this.displayInlineResults(result, document, position, query, queryType);
        } else {
            await this.displaySeparateTabResults(result, query, queryType);
        }
    }

    public async displayResultsWithExplain(
        result: QueryResult,
        explainResult: QueryResult,
        mode: DisplayMode,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        document?: vscode.TextDocument,
        position?: vscode.Position
    ): Promise<void> {
        if (mode === DisplayMode.Inline && document && position) {
            await this.displayInlineResults(result, document, position, query, queryType);
        } else {
            await this.displaySeparateTabResultsWithExplain(result, explainResult, query, queryType);
        }
    }

    private async displayInlineResults(
        result: QueryResult,
        document: vscode.TextDocument,
        position: vscode.Position,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api'
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        // Find the end of the code block
        const text = document.getText();
        const lines = text.split('\n');
        let insertLine = position.line;

        // Find the closing ``` of the code block
        for (let i = position.line; i < lines.length; i++) {
            if (lines[i].trim() === '```') {
                insertLine = i + 1;
                break;
            }
        }

        // Check if results already exist and remove them
        await this.removeExistingInlineResults(editor, insertLine);

        // Format results
        const formattedResults = this.formatInlineResults(result, query, queryType);
        
        // Insert results
        const insertPosition = new vscode.Position(insertLine, 0);
        await editor.edit(editBuilder => {
            editBuilder.insert(insertPosition, formattedResults);
        });

        // Show success message
        if (result.success) {
            vscode.window.showInformationMessage(
                `Query executed successfully in ${result.executionTime}ms`
            );
        } else {
            vscode.window.showErrorMessage(`Query failed: ${result.error}`);
        }
    }

    private async removeExistingInlineResults(editor: vscode.TextEditor, startLine: number): Promise<void> {
        const document = editor.document;
        const text = document.getText();
        const lines = text.split('\n');

        let startIndex = -1;
        let endIndex = -1;

        // Find existing results markers
        for (let i = startLine; i < lines.length; i++) {
            if (lines[i].includes(ResultsProvider.RESULTS_START)) {
                startIndex = i;
            }
            if (lines[i].includes(ResultsProvider.RESULTS_END)) {
                endIndex = i;
                break;
            }
        }

        // Remove existing results if found
        if (startIndex >= 0 && endIndex >= 0) {
            const startPos = new vscode.Position(startIndex, 0);
            const endPos = new vscode.Position(endIndex + 1, 0);
            const range = new vscode.Range(startPos, endPos);
            
            await editor.edit(editBuilder => {
                editBuilder.delete(range);
            });
        }
    }

    private formatInlineResults(result: QueryResult, query: string, queryType: 'sql' | 'ppl' | 'opensearch-api'): string {
        const timestamp = new Date().toLocaleString();
        let output = `\n${ResultsProvider.RESULTS_START}\n`;
        output += `**OpenSearch Query Results** (${timestamp})\n\n`;


        if (!result.success) {
            output += `❌ **Error**: ${result.error}\n`;
            output += `**Execution Time**: ${result.executionTime}ms\n\n`;
            
            // Add Raw Request information for failed requests
            if (result.requestInfo) {
                output += `**Raw Request**:\n`;
                const { method, endpoint, headers, body } = result.requestInfo;
                
                // Format HTTP request
                let rawRequest = `${method || 'POST'} ${endpoint || '/'} HTTP/1.1\n`;
                if (headers) {
                    Object.entries(headers).forEach(([key, value]) => {
                        rawRequest += `${key}: ${value}\n`;
                    });
                }
                rawRequest += '\n'; // Empty line between headers and body
                if (body) {
                    rawRequest += body;
                }
                
                output += '```http\n';
                output += rawRequest;
                output += '\n```\n\n';
            }
            
            // Add Raw Response information for failed requests
            if (result.responseInfo || result.rawResponse) {
                output += `**Raw Response**:\n`;
                
                if (result.responseInfo) {
                    const { status, statusText, headers } = result.responseInfo;
                    
                    // Format HTTP response
                    let rawResponse = `HTTP/1.1 ${status || 500} ${statusText || 'Internal Server Error'}\n`;
                    if (headers) {
                        Object.entries(headers).forEach(([key, value]) => {
                            rawResponse += `${key}: ${value}\n`;
                        });
                    }
                    rawResponse += '\n'; // Empty line between headers and body
                    if (result.rawResponse) {
                        rawResponse += JSON.stringify(result.rawResponse, null, 2);
                    }
                    
                    output += '```http\n';
                    output += rawResponse;
                    output += '\n```\n\n';
                } else if (result.rawResponse) {
                    output += '```json\n';
                    output += JSON.stringify(result.rawResponse, null, 2);
                    output += '\n```\n\n';
                }
            }
        } else {
            output += `✅ **Query executed successfully**\n`;
            output += `**Query Type**: ${queryType.toUpperCase()}\n`;
            output += `**Execution Time**: ${result.executionTime}ms\n`;
            
            if (result.rowCount !== undefined) {
                output += `**Rows**: ${result.rowCount}\n`;
            }
            
            output += '\n';

            // Format data as table or JSON
            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                output += this.formatAsMarkdownTable(result.data, result.columns);
            } else if (result.data) {
                output += '**Results**:\n```json\n';
                output += JSON.stringify(result.data, null, 2);
                output += '\n```\n';
            } else {
                output += '**No results found**\n';
            }
        }

        output += `${ResultsProvider.RESULTS_END}\n`;
        return output;
    }

    private formatAsMarkdownTable(data: any[], columns?: string[]): string {
        if (data.length === 0) {
            return '**No results found**\n\n';
        }

        // Determine columns to display
        let displayColumns: string[];
        if (columns && columns.length > 0) {
            displayColumns = columns.slice(0, 8); // Limit for inline display
        } else {
            const firstRow = data[0];
            displayColumns = Object.keys(firstRow).slice(0, 8);
        }

        // Create table header
        let table = '| ' + displayColumns.join(' | ') + ' |\n';
        table += '| ' + displayColumns.map(() => '---').join(' | ') + ' |\n';

        // Add data rows (limit to first 20 rows for inline display)
        const rowsToShow = Math.min(data.length, 20);
        for (let i = 0; i < rowsToShow; i++) {
            const row = data[i];
            const values = displayColumns.map(col => {
                let value = this.getNestedValue(row, col);
                if (value === null || value === undefined) {
                    return '';
                }
                if (typeof value === 'object') {
                    return JSON.stringify(value).substring(0, 50) + '...';
                }
                const strValue = String(value);
                return strValue.length > 50 ? strValue.substring(0, 47) + '...' : strValue;
            });
            table += '| ' + values.join(' | ') + ' |\n';
        }

        if (data.length > 20) {
            table += `\n*Showing first 20 of ${data.length} rows*\n`;
        }

        return table + '\n';
    }

    private async displaySeparateTabResults(
        result: QueryResult,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api'
    ): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'opensearchResults',
            'OpenSearch Query Results',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateResultsHtml(result, query, queryType);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'showHistory':
                        // Execute the show history command
                        await vscode.commands.executeCommand('opensearch-query.showHistory');
                        break;
                }
            }
        );

        // Show success/error message
        if (result.success) {
            vscode.window.showInformationMessage(
                `Query executed successfully in ${result.executionTime}ms`
            );
        } else {
            vscode.window.showErrorMessage(`Query failed: ${result.error}`);
        }
    }

    private async displaySeparateTabResultsWithExplain(
        result: QueryResult,
        explainResult: QueryResult,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api'
    ): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'opensearchResults',
            'OpenSearch Query Results',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateResultsHtmlWithExplain(result, explainResult, query, queryType);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'showHistory':
                        // Execute the show history command
                        await vscode.commands.executeCommand('opensearch-query.showHistory');
                        break;
                }
            }
        );

        // Show success/error message
        if (result.success) {
            vscode.window.showInformationMessage(
                `Query executed successfully in ${result.executionTime}ms`
            );
        } else {
            vscode.window.showErrorMessage(`Query failed: ${result.error}`);
        }
    }

    private generateResultsHtml(result: QueryResult, query: string, queryType: 'sql' | 'ppl' | 'opensearch-api'): string {
        return this.generateUnifiedResultsHtml(result, query, queryType);
    }

    private generateResultsHtmlWithExplain(
        result: QueryResult, 
        explainResult: QueryResult, 
        query: string, 
        queryType: 'sql' | 'ppl' | 'opensearch-api'
    ): string {
        return this.generateUnifiedResultsHtml(result, query, queryType, explainResult);
    }

    private generateUnifiedResultsHtml(
        result: QueryResult, 
        query: string, 
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        explainResult?: QueryResult
    ): string {
        const timestamp = new Date().toLocaleString();
        const tabs = TabContentGenerator.generateResultTabs(result, explainResult);
        const tabsHtml = TabContentGenerator.generateTabsHtml(tabs);
        const metadata = HttpFormatter.generateMetadata(result, explainResult);
        
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
                    <div class="header-right">
                        <button class="btn history-btn" onclick="showHistory()" title="View Query History">
                            <span class="icon">📋</span>
                            History
                        </button>
                    </div>
                </div>
            </div>

            <div class="query-info">
                <div class="query-type-label">${queryType.toUpperCase()}</div>
                <div class="query-content">
                    <pre>${query}</pre>
                </div>
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
                .history-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: background-color 0.2s ease;
                }
                .history-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .history-btn .icon {
                    font-size: 1em;
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

                function showHistory() {
                    vscode.postMessage({
                        command: 'showHistory'
                    });
                }
        `;
    }


    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

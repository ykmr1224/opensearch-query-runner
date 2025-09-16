import * as vscode from 'vscode';
import { QueryResult, DisplayMode } from './types';
import { HttpFormatter } from './utils/httpFormatter';
import { TabContentGenerator } from './utils/tabContentGenerator';
import { PersistentResultsManager } from './persistentResultsManager';
import { HistoryManager } from './historyManager';
import { TimestampFormatter } from './utils/timestampFormatter';
import { WebviewStyles } from './utils/webviewStyles';

export class ResultsProvider {
    private static readonly RESULTS_START = '<!-- OpenSearch Results Start -->';
    private static readonly RESULTS_END = '<!-- OpenSearch Results End -->';
    private historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
    }

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
        const isRst = document.languageId === 'restructuredtext';

        if (isRst) {
            // For RST, find the end of the code-block content
            // Start from the position and look for the end of indented content
            for (let i = position.line + 1; i < lines.length; i++) {
                const line = lines[i];
                // If we hit a non-indented line that's not empty, or another directive, we've found the end
                if (line.length > 0 && !line.match(/^\s/) && !line.match(/^\s*$/)) {
                    insertLine = i;
                    break;
                }
                // If we reach the end of the document
                if (i === lines.length - 1) {
                    insertLine = i + 1;
                    break;
                }
            }
        } else {
            // For Markdown, find the closing ``` of the code block
            for (let i = position.line; i < lines.length; i++) {
                if (lines[i].trim() === '```') {
                    insertLine = i + 1;
                    break;
                }
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
        const timestamp = TimestampFormatter.formatLocal(result.executedAt);
        let output = `\n${ResultsProvider.RESULTS_START}\n`;
        output += `**${queryType.toUpperCase()} @ ${timestamp}**\n\n`;


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

        output += `${ResultsProvider.RESULTS_END}\n\n`;
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

        // Create table header with row number column
        let table = '| # | ' + displayColumns.join(' | ') + ' |\n';
        table += '| --- | ' + displayColumns.map(() => '---').join(' | ') + ' |\n';

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
            table += `| ${i + 1} | ` + values.join(' | ') + ' |\n';
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
        const persistentManager = PersistentResultsManager.getInstance(this.historyManager);
        await persistentManager.showResults(result, query, queryType);
    }

    private async displaySeparateTabResultsWithExplain(
        result: QueryResult,
        explainResult: QueryResult,
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api'
    ): Promise<void> {
        const persistentManager = PersistentResultsManager.getInstance(this.historyManager);
        await persistentManager.showResults(result, query, queryType, explainResult);
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
        const timestamp = TimestampFormatter.formatLocal(result.executedAt);
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

            <div class="query-info">
                <div class="query-type-label">${queryType.toUpperCase()} @ ${timestamp}</div>
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

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

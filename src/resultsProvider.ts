import * as vscode from 'vscode';
import { QueryResult, QueryHistoryItem, DisplayMode } from './types';

export class ResultsProvider {
    private static readonly RESULTS_MARKER = '<!-- OpenSearch Query Results -->';
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
        const timestamp = new Date().toLocaleString();
        
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OpenSearch Query Results</title>
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
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .query-info {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding: 10px 15px;
                    margin-bottom: 20px;
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
            </style>
        </head>
        <body>
            <div class="header">
                <h1>OpenSearch Query Results</h1>
                <p>Executed at ${timestamp}</p>
            </div>

            <div class="query-info">
                <strong>Query Type:</strong> ${queryType.toUpperCase()}<br>
                <strong>Query:</strong><br>
                <pre>${query}</pre>
            </div>

            ${this.generateResultContent(result)}

            <script>
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
            </script>
        </body>
        </html>
        `;
    }

    private generateResultContent(result: QueryResult): string {
        const rawRequestSection = this.generateRawRequestSection(result);
        const rawResponseSection = this.generateRawResponseSection(result);
        
        if (!result.success) {
            // For errors, show Error tab, Raw Request, and Raw Response tabs
            return `
                <div class="metadata">
                    <span class="metadata-item error">❌ Error</span>
                    <span class="metadata-item">⏱️ ${result.executionTime}ms</span>
                </div>
                
                <div class="tabs">
                    <div class="tab active" onclick="showTab('error')">Error Details</div>
                    <div class="tab" onclick="showTab('raw-request')">Raw Request</div>
                    <div class="tab" onclick="showTab('raw-response')">Raw Response</div>
                </div>
                
                <div id="error" class="tab-content active">
                    <div class="json-container">
                        <pre>${result.error}</pre>
                    </div>
                </div>
                
                <div id="raw-request" class="tab-content">
                    ${rawRequestSection}
                </div>
                
                <div id="raw-response" class="tab-content">
                    ${rawResponseSection}
                </div>
            `;
        }

        const metadata = `
            <div class="metadata">
                <span class="metadata-item success">✅ Success</span>
                <span class="metadata-item">⏱️ ${result.executionTime}ms</span>
                ${result.rowCount !== undefined ? `<span class="metadata-item">📊 ${result.rowCount} rows</span>` : ''}
            </div>
        `;

        if (!result.data) {
            // For successful requests with no data, show JSON, Raw Request, and Raw Response tabs
            return metadata + `
                <div class="tabs">
                    <div class="tab active" onclick="showTab('json')">JSON View</div>
                    <div class="tab" onclick="showTab('raw-request')">Raw Request</div>
                    <div class="tab" onclick="showTab('raw-response')">Raw Response</div>
                </div>
                
                <div id="json" class="tab-content active">
                    <p>No results found</p>
                </div>
                
                <div id="raw-request" class="tab-content">
                    ${rawRequestSection}
                </div>
                
                <div id="raw-response" class="tab-content">
                    ${rawResponseSection}
                </div>
            `;
        }

        const hasTableData = Array.isArray(result.data) && result.data.length > 0;
        
        let content = metadata;
        
        if (hasTableData) {
            content += `
                <div class="tabs">
                    <div class="tab active" onclick="showTab('table')">Table View</div>
                    <div class="tab" onclick="showTab('json')">JSON View</div>
                    <div class="tab" onclick="showTab('raw-request')">Raw Request</div>
                    <div class="tab" onclick="showTab('raw-response')">Raw Response</div>
                </div>
                
                <div id="table" class="tab-content active">
                    ${this.generateHtmlTable(result.data, result.columns, result.rawResponse?.schema)}
                </div>
                
                <div id="json" class="tab-content">
                    <div class="json-container">
                        <pre>${JSON.stringify(result.data, null, 2)}</pre>
                    </div>
                </div>
                
                <div id="raw-request" class="tab-content">
                    ${rawRequestSection}
                </div>
                
                <div id="raw-response" class="tab-content">
                    ${rawResponseSection}
                </div>
            `;
        } else {
            content += `
                <div class="tabs">
                    <div class="tab active" onclick="showTab('json')">JSON View</div>
                    <div class="tab" onclick="showTab('raw-request')">Raw Request</div>
                    <div class="tab" onclick="showTab('raw-response')">Raw Response</div>
                </div>
                
                <div id="json" class="tab-content active">
                    <div class="json-container">
                        <pre>${JSON.stringify(result.data, null, 2)}</pre>
                    </div>
                </div>
                
                <div id="raw-request" class="tab-content">
                    ${rawRequestSection}
                </div>
                
                <div id="raw-response" class="tab-content">
                    ${rawResponseSection}
                </div>
            `;
        }

        return content;
    }

    private generateRawRequestSection(result: QueryResult): string {
        if (!result.requestInfo) {
            return `
                <div class="debug-section">
                    <div class="debug-item">
                        <h3>📤 Raw HTTP Request</h3>
                        <div class="json-container">
                            <pre>No request information available</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        const { method, endpoint, headers, body } = result.requestInfo;
        
        // Format HTTP headers
        let headersText = '';
        if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
                headersText += `${key}: ${value}\n`;
            });
        }

        // Build the raw HTTP request
        let rawRequest = `${method || 'POST'} ${endpoint || '/'} HTTP/1.1\n`;
        if (headersText) {
            rawRequest += headersText;
        }
        rawRequest += '\n'; // Empty line between headers and body
        if (body) {
            rawRequest += body;
        }

        return `
            <div class="debug-section">
                <div class="debug-item">
                    <h3>📤 Raw HTTP Request</h3>
                    <div class="json-container">
                        <pre>${rawRequest}</pre>
                    </div>
                </div>
                <div class="debug-item">
                    <h3>🔧 Request Details</h3>
                    <div class="json-container">
                        <pre>${JSON.stringify(result.requestInfo, null, 2)}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    private generateRawResponseSection(result: QueryResult): string {
        if (!result.responseInfo && !result.rawResponse) {
            return `
                <div class="debug-section">
                    <div class="debug-item">
                        <h3>📥 Raw HTTP Response</h3>
                        <div class="json-container">
                            <pre>No response information available</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        let content = '<div class="debug-section">';

        // Add raw HTTP response if we have response info
        if (result.responseInfo) {
            const { status, statusText, headers } = result.responseInfo;
            
            // Format HTTP headers
            let headersText = '';
            if (headers) {
                Object.entries(headers).forEach(([key, value]) => {
                    headersText += `${key}: ${value}\n`;
                });
            }

            // Build the raw HTTP response
            let rawResponse = `HTTP/1.1 ${status || 200} ${statusText || 'OK'}\n`;
            if (headersText) {
                rawResponse += headersText;
            }
            rawResponse += '\n'; // Empty line between headers and body
            if (result.rawResponse) {
                rawResponse += JSON.stringify(result.rawResponse, null, 2);
            }

            content += `
                <div class="debug-item">
                    <h3>📥 Raw HTTP Response</h3>
                    <div class="json-container">
                        <pre>${rawResponse}</pre>
                    </div>
                </div>
            `;
        }

        // Add response details
        if (result.responseInfo) {
            content += `
                <div class="debug-item">
                    <h3>🔧 Response Details</h3>
                    <div class="json-container">
                        <pre>${JSON.stringify(result.responseInfo, null, 2)}</pre>
                    </div>
                </div>
            `;
        }

        // Add raw response body
        if (result.rawResponse) {
            content += `
                <div class="debug-item">
                    <h3>📄 Response Body</h3>
                    <div class="json-container">
                        <pre>${JSON.stringify(result.rawResponse, null, 2)}</pre>
                    </div>
                </div>
            `;
        }

        content += '</div>';
        return content;
    }

    private generateDebugSection(result: QueryResult): string {
        let debugContent = '<div class="debug-section">';
        
        // Add complete QueryResult object for debugging
        debugContent += `
            <div class="debug-item">
                <h3>🔍 Complete Query Result</h3>
                <div class="json-container">
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                </div>
            </div>
        `;
        
        // Add request information if available
        if (result.requestInfo) {
            debugContent += `
                <div class="debug-item">
                    <h3>📤 Request Details</h3>
                    <div class="json-container">
                        <pre>${JSON.stringify(result.requestInfo, null, 2)}</pre>
                    </div>
                </div>
            `;
        } else {
            debugContent += `
                <div class="debug-item">
                    <h3>📤 Request Details</h3>
                    <div class="json-container">
                        <pre>No request information available</pre>
                    </div>
                </div>
            `;
        }
        
        // Add raw response
        if (result.rawResponse) {
            debugContent += `
                <div class="debug-item">
                    <h3>📥 Raw Response</h3>
                    <div class="json-container">
                        <pre>${JSON.stringify(result.rawResponse, null, 2)}</pre>
                    </div>
                </div>
            `;
        } else {
            debugContent += `
                <div class="debug-item">
                    <h3>📥 Raw Response</h3>
                    <div class="json-container">
                        <pre>No raw response available</pre>
                    </div>
                </div>
            `;
        }
        
        debugContent += '</div>';
        return debugContent;
    }

    private generateHtmlTable(data: any[], columns?: string[], schema?: Array<{name: string, type: string}>): string {
        if (data.length === 0) {
            return '<p>No results found</p>';
        }

        // Determine columns to display
        let displayColumns: string[];
        if (columns && columns.length > 0) {
            displayColumns = columns;
        } else {
            const firstRow = data[0];
            displayColumns = Object.keys(firstRow);
        }

        // Create a map of column names to types for quick lookup
        const columnTypeMap = new Map<string, string>();
        if (schema) {
            schema.forEach(col => {
                columnTypeMap.set(col.name, col.type);
            });
        }

        // Create table
        let table = '<table><thead><tr>';
        displayColumns.forEach(col => {
            const columnType = columnTypeMap.get(col);
            const tooltip = columnType ? ` title="Type: ${columnType}"` : '';
            table += `<th${tooltip}>${col}</th>`;
        });
        table += '</tr></thead><tbody>';

        // Add data rows
        data.forEach(row => {
            table += '<tr>';
            displayColumns.forEach(col => {
                let value = this.getNestedValue(row, col);
                if (value === null || value === undefined) {
                    value = '';
                } else if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                table += `<td>${String(value)}</td>`;
            });
            table += '</tr>';
        });

        table += '</tbody></table>';
        return table;
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

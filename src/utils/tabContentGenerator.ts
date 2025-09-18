import { QueryResult } from '../types';
import { HttpFormatter } from './httpFormatter';
import { YamlConverter } from './yamlConverter';

export interface TabConfig {
    id: string;
    label: string;
    content: string;
    active?: boolean;
}

export class TabContentGenerator {
    /**
     * Generates tab configuration for query results
     */
    public static generateResultTabs(result: QueryResult, explainResult?: QueryResult): TabConfig[] {
        const tabs: TabConfig[] = [];

        if (!result.success) {
            // Error case: Enhanced Error Details, Raw Request, Raw Response
            tabs.push({
                id: 'error',
                label: 'Error Details',
                content: this.generateErrorDetailsContent(result),
                active: true
            });
        } else {
            // Success case: determine primary tab based on data type
            const hasTableData = Array.isArray(result.data) && result.data.length > 0;
            
            if (hasTableData) {
                tabs.push({
                    id: 'table',
                    label: 'Table View',
                    content: this.generateTableContent(result),
                    active: true
                });

                // Add text view tab for table data
                tabs.push({
                    id: 'text',
                    label: 'Text View',
                    content: this.generateTextContent(result)
                });
            }

            // Always add JSON view
            tabs.push({
                id: 'json',
                label: 'JSON View',
                content: this.generateJsonContent(result),
                active: !hasTableData // Active if no table data
            });

            // Add explain tab if explain result is provided
            if (explainResult) {
                tabs.push({
                    id: 'explain',
                    label: '🔍 Explain',
                    content: this.generateExplainContent(explainResult)
                });
            }
        }

        // Always add Raw Request and Raw Response tabs
        tabs.push({
            id: 'raw-request',
            label: 'Raw Request',
            content: HttpFormatter.generateRawRequestSection(result)
        });

        tabs.push({
            id: 'raw-response',
            label: 'Raw Response',
            content: HttpFormatter.generateRawResponseSection(result)
        });

        return tabs;
    }

    /**
     * Generates HTML for tabs navigation
     */
    public static generateTabsHtml(tabs: TabConfig[]): string {
        const tabHeaders = tabs.map(tab => 
            `<div class="tab${tab.active ? ' active' : ''}" onclick="showTab('${tab.id}')">${tab.label}</div>`
        ).join('\n                    ');

        const tabContents = tabs.map(tab =>
            `<div id="${tab.id}" class="tab-content${tab.active ? ' active' : ''}">\n                    ${tab.content}\n                </div>`
        ).join('\n                \n                ');

        return `
                <div class="tabs">
                    ${tabHeaders}
                </div>
                
                ${tabContents}
        `;
    }

    private static generateTableContent(result: QueryResult): string {
        return this.generateHtmlTable(result.data, result.columns, result.rawResponse?.schema);
    }

    private static generateTextContent(result: QueryResult): string {
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            return '<p>No results found</p>';
        }

        const textTable = this.generateTextTable(result.data, result.columns, result.rowCount);
        const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const copyButtonId = `copy-text-${textId}`;

        return `
            <div class="text-container">
                <div class="text-copy-header">
                    <button id="${copyButtonId}" class="copy-btn" onclick="copyToClipboard('${textId}', '${copyButtonId}')">Copy Text</button>
                </div>
                <div class="text-table-container">
                    <pre id="${textId}">${textTable}</pre>
                </div>
            </div>
        `;
    }

    private static generateJsonContent(result: QueryResult): string {
        if (!result.data) {
            return '<p>No results found</p>';
        }

        const jsonString = JSON.stringify(result.data, null, 2);
        const containerId = YamlConverter.generateContentId();
        
        return YamlConverter.createToggleContainer(jsonString, containerId);
    }

    private static generateExplainContent(explainResult: QueryResult): string {
        if (!explainResult.success) {
            return `
                <div class="debug-section">
                    <div class="debug-item">
                        <h3>❌ Explain Query Failed</h3>
                        <div class="json-container">
                            <pre>${explainResult.error}</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        // For successful explain results, create separate sections
        let content = '<div class="debug-section">';
        
        // Extract just the execution plan data (without request/response info)
        const executionPlan = this.extractExecutionPlan(explainResult);
        
        if (executionPlan) {
            const planJsonString = JSON.stringify(executionPlan, null, 2);
            const planContainerId = YamlConverter.generateContentId();
            
            content += `
                <div class="debug-item">
                    <h3>🔍 Query Execution Plan</h3>
                    ${YamlConverter.createToggleContainer(planJsonString, planContainerId)}
                </div>
            `;
        }

        // Add explain request details in a separate section
        if (explainResult.requestInfo) {
            const rawRequest = HttpFormatter.formatRawRequest(explainResult.requestInfo);

            content += `
                <div class="debug-item">
                    <h3>📤 Explain Request Details</h3>
                    <div class="json-container">
                        <pre>${rawRequest}</pre>
                    </div>
                </div>
            `;
        }

        // Add explain response details in a separate section
        if (explainResult.rawResponse) {
            const responseJsonString = JSON.stringify(explainResult.rawResponse, null, 2);
            const responseContainerId = YamlConverter.generateContentId();
            
            content += `
                <div class="debug-item">
                    <h3>📄 Explain Raw Response</h3>
                    ${YamlConverter.createToggleContainer(responseJsonString, responseContainerId)}
                </div>
            `;
        }

        content += '</div>';
        return content;
    }

    private static extractExecutionPlan(explainResult: QueryResult): any {
        // Extract only the execution plan data, excluding request/response metadata
        if (!explainResult.data) {
            return null;
        }

        // If the data is the raw response, try to extract the actual plan
        if (explainResult.rawResponse) {
            // Create a clean copy without request/response info
            const cleanData = { ...explainResult.rawResponse };
            
            // Remove request/response metadata if present
            delete cleanData.requestInfo;
            delete cleanData.responseInfo;
            
            return cleanData;
        }

        // If data is already processed, return it as-is
        return explainResult.data;
    }

    private static generateHtmlTable(data: any[], columns?: string[], schema?: Array<{name: string, type: string}>): string {
        if (!data || data.length === 0) {
            return '<p>No results found</p>';
        }

        // Generate unique ID for this table
        const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const copyButtonId = `copy-table-${tableId}`;

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

        // Create table container with copy button
        let tableContainer = `<div class="table-container">`;
        tableContainer += `<div class="table-copy-header">`;
        tableContainer += `<button id="${copyButtonId}" class="copy-btn" onclick="copyToClipboard('${tableId}', '${copyButtonId}')">Copy Table</button>`;
        tableContainer += `</div>`;

        // Create table with row number column
        let table = `<table id="${tableId}"><thead><tr>`;
        table += '<th class="row-number-header">#</th>'; // Row number header
        displayColumns.forEach(col => {
            const columnType = columnTypeMap.get(col);
            const tooltip = columnType ? ` title="Type: ${columnType}"` : '';
            table += `<th${tooltip}>${col}</th>`;
        });
        table += '</tr></thead><tbody>';

        // Add data rows with row numbers
        data.forEach((row, index) => {
            table += '<tr>';
            table += `<td class="row-number">${index + 1}</td>`; // Row number (1-based)
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
        tableContainer += table + '</div>';
        return tableContainer;
    }

    private static generateErrorDetailsContent(result: QueryResult): string {
        let content = '<div class="debug-section">';
        
        // Main error message
        content += `
            <div class="debug-item">
                <h3>❌ Error Summary</h3>
                <div class="json-container">
                    <pre>${result.error || 'No error message available'}</pre>
                </div>
            </div>
        `;

        // Check if we have enhanced error details from our ErrorHandler OR server error details
        if (result.rawResponse && result.rawResponse.error && result.rawResponse.error.details) {
            const errorDetails = result.rawResponse.error.details;
            
            // Check if this is an escaped JSON string from OpenSearch server
            if (typeof errorDetails === 'string') {
                try {
                    const parsedDetails = JSON.parse(errorDetails);
                    const detailsContainerId = YamlConverter.generateContentId();
                    const detailsContent = JSON.stringify(parsedDetails, null, 2);
                    
                    content += `
                        <div class="debug-item">
                            <h3>🔍 Server Error Details</h3>
                            ${YamlConverter.createToggleContainer(detailsContent, detailsContainerId, true)}
                        </div>
                    `;
                } catch {
                    // If parsing fails, show as plain text
                    content += `
                        <div class="debug-item">
                            <h3>🔍 Server Error Details</h3>
                            <div class="json-container">
                                <pre>${errorDetails}</pre>
                            </div>
                        </div>
                    `;
                }
            } else if (errorDetails && typeof errorDetails === 'object') {
                // Show full error details as JSON
                const fullDetailsContainerId = YamlConverter.generateContentId();
                const fullDetailsContent = JSON.stringify(errorDetails, null, 2);
                
                content += `
                    <div class="debug-item">
                        <h3>🔧 Full Error Details</h3>
                        ${YamlConverter.createToggleContainer(fullDetailsContent, fullDetailsContainerId, true)}
                    </div>
                `;
            }
        } else {
            // Fallback: if no enhanced error details, show basic error
            content += `
                <div class="debug-item">
                    <h3>ℹ️ Basic Error Information</h3>
                    <div class="json-container">
                        <pre>No detailed error information available.
                        
This may be due to:
- Network connectivity issues
- Server configuration problems
- Authentication/authorization failures
- Invalid request format

Check the Raw Request and Raw Response tabs for more information.</pre>
                    </div>
                </div>
            `;
        }
        
        content += '</div>';
        return content;
    }

    private static generateTextTable(data: any[], columns?: string[], totalRows?: number): string {
        if (!data || data.length === 0) {
            return 'No results found';
        }

        // Determine columns to display
        let displayColumns: string[];
        if (columns && columns.length > 0) {
            displayColumns = columns;
        } else {
            const firstRow = data[0];
            displayColumns = Object.keys(firstRow);
        }

        // Convert data to string values and calculate column widths
        const stringData: string[][] = [];
        const columnWidths: number[] = displayColumns.map(col => col.length);

        // Process each row and calculate max widths
        data.forEach(row => {
            const stringRow: string[] = [];
            displayColumns.forEach((col, colIndex) => {
                let value = this.getNestedValue(row, col);
                if (value === null || value === undefined) {
                    value = ''; // Empty string for null/undefined values
                } else if (typeof value === 'object') {
                    value = JSON.stringify(value);
                } else {
                    value = String(value);
                }
                stringRow.push(value);
                columnWidths[colIndex] = Math.max(columnWidths[colIndex], value.length);
            });
            stringData.push(stringRow);
        });

        // Build the text table
        let result = '';
        
        // Add row count information
        const fetchedRows = data.length;
        const total = totalRows || fetchedRows;
        result += `fetched rows / total rows = ${fetchedRows}/${total}\n`;

        // Create top border
        result += '+';
        columnWidths.forEach(width => {
            result += '-'.repeat(width + 2) + '+';
        });
        result += '\n';

        // Create header row
        result += '|';
        displayColumns.forEach((col, index) => {
            const padding = columnWidths[index] - col.length;
            result += ` ${col}${' '.repeat(padding)} |`;
        });
        result += '\n';

        // Create header separator
        result += '|';
        columnWidths.forEach(width => {
            result += '-'.repeat(width + 2) + '|';
        });
        result += '\n';

        // Create data rows
        stringData.forEach(row => {
            result += '|';
            row.forEach((cell, index) => {
                const padding = columnWidths[index] - cell.length;
                result += ` ${cell}${' '.repeat(padding)} |`;
            });
            result += '\n';
        });

        // Create bottom border
        result += '+';
        columnWidths.forEach(width => {
            result += '-'.repeat(width + 2) + '+';
        });

        return result;
    }

    private static getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

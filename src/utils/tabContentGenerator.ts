import { QueryResult } from '../types';
import { HttpFormatter } from './httpFormatter';

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
            // Error case: Error Details, Raw Request, Raw Response
            tabs.push({
                id: 'error',
                label: 'Error Details',
                content: `
                    <div class="json-container">
                        <pre>${result.error}</pre>
                    </div>
                `,
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

    private static generateJsonContent(result: QueryResult): string {
        if (!result.data) {
            return '<p>No results found</p>';
        }

        return `
            <div class="json-container">
                <pre>${JSON.stringify(result.data, null, 2)}</pre>
            </div>
        `;
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
        
        content += `
            <div class="debug-item">
                <h3>🔍 Query Execution Plan</h3>
                <div class="json-container">
                    <pre>${JSON.stringify(executionPlan, null, 2)}</pre>
                </div>
            </div>
        `;

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
            content += `
                <div class="debug-item">
                    <h3>📄 Explain Raw Response</h3>
                    <div class="json-container">
                        <pre>${JSON.stringify(explainResult.rawResponse, null, 2)}</pre>
                    </div>
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

        // Create table with row number column
        let table = '<table><thead><tr>';
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
        return table;
    }

    private static getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

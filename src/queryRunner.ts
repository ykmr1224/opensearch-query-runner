import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { MarkdownParser } from './markdownParser';
import { QueryResult, QueryBlock, OpenSearchResponse, DisplayMode } from './types';

export class QueryRunner {
    private connectionManager: ConnectionManager;

    constructor(connectionManager: ConnectionManager) {
        this.connectionManager = connectionManager;
    }

    public async executeQuery(
        query: string, 
        queryType: 'sql' | 'ppl' | 'opensearch-api', 
        timeout?: number,
        metadata?: any
    ): Promise<QueryResult> {
        const startTime = Date.now();

        try {
            // Validate query
            const validation = MarkdownParser.validateQuery(query, queryType, metadata);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                    executionTime: Date.now() - startTime
                };
            }

            let response: any;
            
            // Execute based on query type
            if (queryType === 'opensearch-api') {
                if (!metadata?.method || !metadata?.endpoint) {
                    return {
                        success: false,
                        error: 'API operations require method and endpoint metadata',
                        executionTime: Date.now() - startTime
                    };
                }
                response = await this.connectionManager.executeApiOperation(
                    metadata.method, 
                    metadata.endpoint, 
                    query
                );
            } else {
                response = await this.connectionManager.executeQuery(query, queryType);
            }
            
            const executionTime = Date.now() - startTime;

            if (response.error) {
            return {
                success: false,
                error: `${response.error.type}: ${response.error.reason}`,
                executionTime,
                rawResponse: response,
                requestInfo: response.requestInfo,
                responseInfo: response.responseInfo
            };
            }

            // Process successful response
            const result = this.processQueryResponse(response, executionTime, queryType);
            
            // Add request info if available
            if (response.requestInfo) {
                result.requestInfo = response.requestInfo;
            }
            
            // Add response info if available
            if (response.responseInfo) {
                result.responseInfo = response.responseInfo;
            }
            
            return result;

        } catch (error: any) {
            // Try to extract request/response info from the error if available
            let requestInfo = undefined;
            let responseInfo = undefined;
            let rawResponse = undefined;
            
            if (error.response) {
                // This is likely an axios error with response info
                responseInfo = {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    headers: error.response.headers
                };
                rawResponse = error.response.data;
            }
            
            if (error.config) {
                // This is likely an axios error with request config
                requestInfo = {
                    method: error.config.method?.toUpperCase(),
                    endpoint: error.config.url,
                    headers: error.config.headers,
                    body: error.config.data ? (typeof error.config.data === 'string' ? error.config.data : JSON.stringify(error.config.data, null, 2)) : undefined
                };
            }
            
            return {
                success: false,
                error: error.message || 'Unknown error occurred',
                executionTime: Date.now() - startTime,
                requestInfo,
                responseInfo,
                rawResponse
            };
        }
    }

    public async executeQueryFromBlock(queryBlock: QueryBlock): Promise<QueryResult> {
        const timeout = queryBlock.metadata?.timeout;
        return this.executeQuery(queryBlock.content, queryBlock.type, timeout, queryBlock.metadata);
    }

    public async executeQueryAtPosition(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): Promise<QueryResult | null> {
        const queryBlock = MarkdownParser.findQueryBlockAtPosition(document, position);
        
        if (!queryBlock) {
            vscode.window.showWarningMessage('No query block found at cursor position');
            return null;
        }

        return this.executeQueryFromBlock(queryBlock);
    }

    private processQueryResponse(response: OpenSearchResponse, executionTime: number, queryType?: string): QueryResult {
        let data: any = null;
        let rowCount: number | undefined = undefined;
        let columns: string[] | undefined = undefined;

        // Handle SQL response format
        if (response.schema && response.datarows) {
            columns = response.schema.map(col => col.name);
            data = this.formatSqlResponse(response.schema, response.datarows);
            rowCount = response.datarows.length;
        }
        // Handle search response format
        else if (response.hits) {
            data = response.hits.hits;
            rowCount = response.hits.total?.value || response.hits.hits.length;
            columns = this.extractColumnsFromHits(response.hits.hits);
        }
        // Handle API response formats
        else if (queryType === 'opensearch-api') {
            data = response;
            // For API operations, try to extract meaningful row count
            const apiResponse = response as any;
            if (apiResponse.acknowledged !== undefined) {
                // Index creation, deletion, etc.
                rowCount = apiResponse.acknowledged ? 1 : 0;
            } else if (apiResponse._id) {
                // Document operations
                rowCount = 1;
            } else if (Array.isArray(response)) {
                rowCount = response.length;
            }
        }
        // Handle aggregation or other response formats
        else {
            data = response;
            rowCount = Array.isArray(data) ? data.length : undefined;
        }

        return {
            success: true,
            data,
            executionTime,
            rowCount,
            columns,
            rawResponse: response
        };
    }

    private formatSqlResponse(schema: Array<{name: string, type: string}>, datarows: any[][]): any[] {
        return datarows.map(row => {
            const obj: any = {};
            schema.forEach((col, index) => {
                obj[col.name] = row[index];
            });
            return obj;
        });
    }

    private extractColumnsFromHits(hits: any[]): string[] {
        if (hits.length === 0) {
            return [];
        }

        const firstHit = hits[0];
        const columns = new Set<string>();

        // Add standard fields
        columns.add('_index');
        columns.add('_id');
        columns.add('_score');

        // Add source fields
        if (firstHit._source) {
            this.extractFieldNames(firstHit._source, '', columns);
        }

        return Array.from(columns);
    }

    private extractFieldNames(obj: any, prefix: string, columns: Set<string>): void {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    this.extractFieldNames(obj[key], fullKey, columns);
                } else {
                    columns.add(fullKey);
                }
            }
        }
    }

    public formatResultForDisplay(result: QueryResult, format: 'table' | 'json' = 'table'): string {
        if (!result.success) {
            return `❌ **Error**: ${result.error}\n\n**Execution Time**: ${result.executionTime}ms`;
        }

        let output = '';

        // Add metadata
        output += `✅ **Query executed successfully**\n`;
        output += `**Execution Time**: ${result.executionTime}ms\n`;
        if (result.rowCount !== undefined) {
            output += `**Rows**: ${result.rowCount}\n`;
        }
        output += '\n';

        if (format === 'table' && result.data && Array.isArray(result.data) && result.data.length > 0) {
            output += this.formatAsTable(result.data, result.columns);
        } else if (result.data) {
            output += '**Results**:\n```json\n';
            output += JSON.stringify(result.data, null, 2);
            output += '\n```\n';
        }

        return output;
    }

    private formatAsTable(data: any[], columns?: string[]): string {
        if (data.length === 0) {
            return '**No results found**\n';
        }

        // Determine columns to display
        let displayColumns: string[];
        if (columns && columns.length > 0) {
            displayColumns = columns;
        } else {
            // Extract columns from first row
            const firstRow = data[0];
            displayColumns = Object.keys(firstRow);
        }

        // Limit columns for readability
        if (displayColumns.length > 10) {
            displayColumns = displayColumns.slice(0, 10);
        }

        // Create table header
        let table = '| ' + displayColumns.join(' | ') + ' |\n';
        table += '| ' + displayColumns.map(() => '---').join(' | ') + ' |\n';

        // Add data rows (limit to first 100 rows)
        const rowsToShow = Math.min(data.length, 100);
        for (let i = 0; i < rowsToShow; i++) {
            const row = data[i];
            const values = displayColumns.map(col => {
                let value = this.getNestedValue(row, col);
                if (value === null || value === undefined) {
                    return '';
                }
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return String(value);
            });
            table += '| ' + values.join(' | ') + ' |\n';
        }

        if (data.length > 100) {
            table += `\n*Showing first 100 of ${data.length} rows*\n`;
        }

        return table + '\n';
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    public async promptForDisplayMode(): Promise<DisplayMode | undefined> {
        const choice = await vscode.window.showQuickPick([
            {
                label: '$(output) Inline Results',
                description: 'Insert results directly below the query',
                value: DisplayMode.Inline
            },
            {
                label: '$(window) Separate Tab',
                description: 'Open results in a new tab with history',
                value: DisplayMode.SeparateTab
            }
        ], {
            placeHolder: 'Choose how to display query results'
        });

        return choice?.value;
    }

    public getQuerySummary(queryBlock: QueryBlock): string {
        const preview = MarkdownParser.getQueryPreview(queryBlock.content);
        const type = queryBlock.type.toUpperCase();
        return `${type}: ${preview}`;
    }
}

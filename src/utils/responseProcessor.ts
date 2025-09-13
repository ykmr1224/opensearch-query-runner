import { QueryResult, OpenSearchResponse } from '../types';

export class ResponseProcessor {
    /**
     * Processes query response into standardized QueryResult format
     */
    public static processQueryResponse(
        response: OpenSearchResponse, 
        executionTime: number, 
        queryType?: string
    ): QueryResult {
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

    /**
     * Formats SQL response data into object array
     */
    private static formatSqlResponse(schema: Array<{name: string, type: string}>, datarows: any[][]): any[] {
        return datarows.map(row => {
            const obj: any = {};
            schema.forEach((col, index) => {
                obj[col.name] = row[index];
            });
            return obj;
        });
    }

    /**
     * Extracts column names from search hits
     */
    private static extractColumnsFromHits(hits: any[]): string[] {
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

    /**
     * Recursively extracts field names from nested objects
     */
    private static extractFieldNames(obj: any, prefix: string, columns: Set<string>): void {
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

    /**
     * Formats result for display in various formats
     */
    public static formatResultForDisplay(result: QueryResult, format: 'table' | 'json' = 'table'): string {
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

    /**
     * Formats data as markdown table
     */
    private static formatAsTable(data: any[], columns?: string[]): string {
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

    /**
     * Gets nested value from object using dot notation
     */
    private static getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Validates response structure
     */
    public static validateResponse(response: any): { valid: boolean; error?: string } {
        if (!response) {
            return { valid: false, error: 'Response is null or undefined' };
        }

        // Check for error responses
        if (response.error) {
            return { valid: false, error: `${response.error.type}: ${response.error.reason}` };
        }

        return { valid: true };
    }

    /**
     * Extracts summary information from response
     */
    public static extractResponseSummary(response: OpenSearchResponse): {
        type: string;
        recordCount: number;
        hasData: boolean;
    } {
        let type = 'unknown';
        let recordCount = 0;
        let hasData = false;

        if (response.schema && response.datarows) {
            type = 'sql';
            recordCount = response.datarows.length;
            hasData = recordCount > 0;
        } else if (response.hits) {
            type = 'search';
            recordCount = response.hits.total?.value || response.hits.hits.length;
            hasData = response.hits.hits.length > 0;
        } else if (Array.isArray(response)) {
            type = 'array';
            recordCount = response.length;
            hasData = recordCount > 0;
        } else if (typeof response === 'object') {
            type = 'object';
            recordCount = 1;
            hasData = true;
        }

        return { type, recordCount, hasData };
    }
}

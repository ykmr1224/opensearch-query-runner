import * as vscode from 'vscode';
import { QueryBlock, QueryMetadata } from './types';

export class MarkdownParser {
    private static readonly CODE_BLOCK_REGEX = /^```(sql|ppl|opensearch-api)\s*\n([\s\S]*?)^```/gm;
    private static readonly METADATA_REGEX = /^--\s*(\w+):\s*(.+)$/gm;

    public static parseDocument(document: vscode.TextDocument): QueryBlock[] {
        const text = document.getText();
        const queryBlocks: QueryBlock[] = [];
        
        let match;
        const regex = new RegExp(this.CODE_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, language, content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const queryType = language.toLowerCase() as 'sql' | 'ppl' | 'opensearch-api';
            const cleanContent = this.extractQueryContent(content, queryType);
            const metadata = this.parseMetadata(content);
            
            // For opensearch-api, we need metadata even if content is empty
            if (cleanContent.trim() || (queryType === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                queryBlocks.push({
                    type: queryType,
                    content: cleanContent,
                    range: new vscode.Range(startPos, endPos),
                    metadata
                });
            }
        }
        
        return queryBlocks;
    }

    public static findQueryBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): QueryBlock | null {
        const queryBlocks = this.parseDocument(document);
        
        for (const block of queryBlocks) {
            if (block.range.contains(position)) {
                return block;
            }
        }
        
        return null;
    }

    private static extractQueryContent(content: string, queryType: 'sql' | 'ppl' | 'opensearch-api'): string {
        const lines = content.split('\n');
        const queryLines: string[] = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and metadata comments
            if (!trimmedLine || this.isMetadataComment(trimmedLine)) {
                continue;
            }
            
            // For opensearch-api, preserve all non-metadata content including JSON
            if (queryType === 'opensearch-api') {
                queryLines.push(line);
            } else {
                // Skip regular comments but preserve them in SQL/PPL queries
                queryLines.push(line);
            }
        }
        
        return queryLines.join('\n').trim();
    }

    private static parseMetadata(content: string): QueryMetadata {
        const metadata: QueryMetadata = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (this.isMetadataComment(trimmedLine)) {
                const metadataMatch = trimmedLine.match(/^--\s*(\w+):\s*(.+)$/);
                if (metadataMatch) {
                    const [, key, value] = metadataMatch;
                    
                    switch (key.toLowerCase()) {
                        case 'connection':
                            metadata.connection = value.trim();
                            break;
                        case 'timeout':
                            const timeoutValue = this.parseTimeout(value.trim());
                            if (timeoutValue) {
                                metadata.timeout = timeoutValue;
                            }
                            break;
                        case 'description':
                            metadata.description = value.trim();
                            break;
                        case 'method':
                            metadata.method = value.trim().toUpperCase();
                            break;
                        case 'endpoint':
                            metadata.endpoint = value.trim();
                            break;
                    }
                }
            }
        }
        
        return metadata;
    }

    private static isMetadataComment(line: string): boolean {
        return /^--\s*\w+:\s*.+$/.test(line);
    }

    private static parseTimeout(value: string): number | null {
        // Parse timeout values like "30s", "5000ms", "2m", etc.
        const match = value.match(/^(\d+)(s|ms|m)?$/i);
        if (!match) {
            return null;
        }
        
        const [, numStr, unit] = match;
        const num = parseInt(numStr, 10);
        
        switch (unit?.toLowerCase()) {
            case 's':
                return num * 1000;
            case 'ms':
                return num;
            case 'm':
                return num * 60 * 1000;
            default:
                // Default to milliseconds if no unit specified
                return num;
        }
    }

    public static getQueryBlocksInRange(document: vscode.TextDocument, range: vscode.Range): QueryBlock[] {
        const queryBlocks = this.parseDocument(document);
        
        return queryBlocks.filter(block => 
            range.intersection(block.range) !== undefined
        );
    }

    public static validateQuery(content: string, type: 'sql' | 'ppl' | 'opensearch-api', metadata?: QueryMetadata): { valid: boolean; error?: string } {
        const trimmedContent = content.trim();
        
        // For opensearch-api, content can be empty for GET/DELETE operations
        if (!trimmedContent && type !== 'opensearch-api') {
            return { valid: false, error: 'Query cannot be empty' };
        }
        
        if (type === 'sql') {
            // Basic SQL validation
            const sqlKeywords = /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\s+/i;
            if (!sqlKeywords.test(trimmedContent)) {
                return { 
                    valid: false, 
                    error: 'SQL query must start with SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN' 
                };
            }
        } else if (type === 'ppl') {
            // Basic PPL validation
            const pplKeywords = /^\s*(source|search)\s*=/i;
            if (!pplKeywords.test(trimmedContent)) {
                return { 
                    valid: false, 
                    error: 'PPL query must start with source= or search=' 
                };
            }
        } else if (type === 'opensearch-api') {
            // API validation
            if (!metadata?.method) {
                return { 
                    valid: false, 
                    error: 'OpenSearch API operation requires Method metadata (-- Method: GET/POST/PUT/DELETE)' 
                };
            }
            
            if (!metadata?.endpoint) {
                return { 
                    valid: false, 
                    error: 'OpenSearch API operation requires Endpoint metadata (-- Endpoint: /index/_doc)' 
                };
            }
            
            const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'];
            if (!validMethods.includes(metadata.method.toUpperCase())) {
                return { 
                    valid: false, 
                    error: `Invalid HTTP method: ${metadata.method}. Must be one of: ${validMethods.join(', ')}` 
                };
            }
            
            // For methods that typically have request bodies, validate JSON if content exists
            if (['POST', 'PUT'].includes(metadata.method.toUpperCase()) && trimmedContent) {
                try {
                    JSON.parse(trimmedContent);
                } catch (error) {
                    return { 
                        valid: false, 
                        error: 'Invalid JSON in request body' 
                    };
                }
            }
        }
        
        return { valid: true };
    }

    public static formatQuery(content: string, type: 'sql' | 'ppl' | 'opensearch-api'): string {
        // Basic query formatting
        const lines = content.split('\n');
        const formattedLines = lines.map(line => line.trim()).filter(line => line.length > 0);
        
        if (type === 'sql') {
            // Basic SQL formatting
            return formattedLines.join('\n');
        } else if (type === 'ppl') {
            // PPL formatting
            return formattedLines.join('\n');
        } else if (type === 'opensearch-api') {
            // JSON formatting for API requests
            try {
                const parsed = JSON.parse(content);
                return JSON.stringify(parsed, null, 2);
            } catch (error) {
                // If not valid JSON, return as-is
                return content;
            }
        }
        
        return content;
    }

    public static getQueryPreview(content: string, maxLength: number = 50): string {
        const cleanContent = content.replace(/\s+/g, ' ').trim();
        
        if (cleanContent.length <= maxLength) {
            return cleanContent;
        }
        
        return cleanContent.substring(0, maxLength - 3) + '...';
    }
}

import * as vscode from 'vscode';
import { QueryBlock, QueryMetadata, ConnectionOverrides, ConfigurationBlock } from './types';
import { IDocumentParser, MarkdownParser, RstParser } from './parsers';

export class DocumentParser {
    public static parseDocument(document: vscode.TextDocument): QueryBlock[] {
        const isRst = document.languageId === 'restructuredtext';
        
        const parser: IDocumentParser = isRst ? new RstParser() : new MarkdownParser();
        return parser.parseDocument(document);
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
        
        if (type === 'opensearch-api') {
            // API validation
            if (!metadata?.method) {
                return { 
                    valid: false, 
                    error: 'OpenSearch API operation requires HTTP method. Use either "METHOD /endpoint" format or "-- Method: GET/POST/PUT/DELETE" metadata comment.' 
                };
            }
            
            if (!metadata?.endpoint) {
                return { 
                    valid: false, 
                    error: 'OpenSearch API operation requires endpoint. Use either "METHOD /endpoint" format or "-- Endpoint: /index/_doc" metadata comment.' 
                };
            }
            
            const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
            if (!validMethods.includes(metadata.method.toUpperCase())) {
                return { 
                    valid: false, 
                    error: `Invalid HTTP method: ${metadata.method}. Must be one of: ${validMethods.join(', ')}` 
                };
            }
            
            // For methods that typically have request bodies, validate JSON if content exists
            if (['POST', 'PUT'].includes(metadata.method.toUpperCase()) && trimmedContent) {
                // Check if this is a bulk operation
                const isBulkOperation = metadata.endpoint?.includes('/_bulk');
                
                if (isBulkOperation) {
                    // For bulk operations, validate each line as JSON (NDJSON format)
                    const lines = trimmedContent.split('\n');
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine) { // Skip empty lines
                            try {
                                JSON.parse(trimmedLine);
                            } catch (error) {
                                return { 
                                    valid: false, 
                                    error: `Invalid JSON in bulk request line: ${trimmedLine}` 
                                };
                            }
                        }
                    }
                } else {
                    // For regular operations, validate as single JSON object
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

    /**
     * Parse configuration blocks from the document
     */
    public static parseConfigurationBlocks(document: vscode.TextDocument): ConfigurationBlock[] {
        const isRst = document.languageId === 'restructuredtext';
        
        const parser: IDocumentParser = isRst ? new RstParser() : new MarkdownParser();
        return parser.parseConfigurationBlocks(document);
    }


    /**
     * Enhanced parseDocument that includes connection overrides
     */
    public static parseDocumentWithOverrides(document: vscode.TextDocument): QueryBlock[] {
        const queryBlocks = this.parseDocument(document);
        const configBlocks = this.parseConfigurationBlocks(document);
        
        // Apply connection overrides to each query block
        for (const queryBlock of queryBlocks) {
            const overrides = this.resolveConfigurationForQuery(document, queryBlock.range.start, configBlocks);
            if (overrides) {
                queryBlock.connectionOverrides = overrides;
            }
        }
        
        return queryBlocks;
    }

    /**
     * Find the closest preceding configuration block for a query
     */
    private static resolveConfigurationForQuery(
        document: vscode.TextDocument,
        position: vscode.Position,
        configBlocks: ConfigurationBlock[]
    ): ConnectionOverrides | null {
        // Calculate the actual position of the query in the document
        const queryStartPosition = position.line * 10000 + position.character;
        
        // Find config blocks that appear before this query
        const precedingConfigs = configBlocks
            .filter(config => {
                // Calculate config block position in the same way
                const configPosition = config.range.start.line * 10000 + config.range.start.character;
                return configPosition < queryStartPosition;
            })
            .sort((a, b) => {
                const aPos = a.range.start.line * 10000 + a.range.start.character;
                const bPos = b.range.start.line * 10000 + b.range.start.character;
                return bPos - aPos; // Closest first
            });
        
        return precedingConfigs[0]?.config || null;
    }

    /**
     * Resolve configuration for a query at a specific position (public method for external use)
     */
    public static resolveConfigurationForQueryAtPosition(
        content: string,
        position: vscode.Position
    ): ConnectionOverrides | null {
        // Create a mock document for parsing
        const mockDocument = {
            getText: () => content,
            positionAt: (offset: number) => {
                const lines = content.substring(0, offset).split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return { line, character } as vscode.Position;
            },
            languageId: 'markdown' // Default to markdown for backward compatibility
        } as vscode.TextDocument;

        const configBlocks = this.parseConfigurationBlocks(mockDocument);
        return this.resolveConfigurationForQuery(mockDocument, position, configBlocks);
    }

    /**
     * Enhanced findQueryBlockAtPosition that includes connection overrides
     */
    public static findQueryBlockAtPositionWithOverrides(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): QueryBlock | null {
        const queryBlocks = this.parseDocumentWithOverrides(document);
        
        for (const block of queryBlocks) {
            if (block.range.contains(position)) {
                return block;
            }
        }
        
        return null;
    }

    /**
     * Validate connection overrides
     */
    public static validateConnectionOverrides(overrides: ConnectionOverrides): { valid: boolean; error?: string } {
        if (overrides.endpoint) {
            try {
                new URL(overrides.endpoint);
            } catch {
                return { valid: false, error: `Invalid endpoint URL: ${overrides.endpoint}` };
            }
        }
        
        if (overrides.auth?.type === 'basic') {
            if (!overrides.auth.username || !overrides.auth.password) {
                return { valid: false, error: 'Basic auth requires both username and password' };
            }
        }
        
        if (overrides.auth?.type === 'apikey') {
            if (!overrides.auth.apiKey) {
                return { valid: false, error: 'API key auth requires api_key' };
            }
        }
        
        if (overrides.timeout && (overrides.timeout < 1000 || overrides.timeout > 300000)) {
            return { valid: false, error: 'Timeout must be between 1000ms and 300000ms (5 minutes)' };
        }
        
        return { valid: true };
    }
}

// Backward compatibility - export the class itself, not an alias
export { DocumentParser as MarkdownParser };

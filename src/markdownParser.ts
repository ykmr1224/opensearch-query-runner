import * as vscode from 'vscode';
import { QueryBlock, QueryMetadata, ConnectionOverrides, ConfigurationBlock } from './types';

export class MarkdownParser {
    private static readonly CODE_BLOCK_REGEX = /^```(sql|ppl|opensearch-api)\s*\n([\s\S]*?)^```/gm;
    private static readonly CONFIG_BLOCK_REGEX = /^```(config|opensearch-config|connection)\s*\n([\s\S]*?)^```/gm;
    private static readonly METADATA_REGEX = /^--\s*(\w+):\s*(.+)$/gm;
    private static readonly CONFIG_VAR_REGEX = /^@(\w+)\s*=\s*['"]([^'"]*)['"]\s*$/;
    private static readonly HTTP_REQUEST_LINE_REGEX = /^(GET|POST|PUT|DELETE|HEAD|PATCH)\s+([^\s]+)(?:\s+HTTP\/[\d.]+)?\s*$/i;

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
            const metadata = this.parseMetadata(content, queryType);
            
            // For opensearch-api, we need metadata even if content is empty
            if (cleanContent.trim() || (queryType === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                // Create range - handle test environment where vscode.Range might not be available
                let range: vscode.Range;
                try {
                    range = new vscode.Range(startPos, endPos);
                } catch {
                    // Fallback for test environment
                    range = {
                        start: startPos,
                        end: endPos,
                        contains: () => false,
                        intersection: () => undefined,
                        isEmpty: false,
                        isSingleLine: startPos.line === endPos.line,
                        isEqual: () => false,
                        union: () => range,
                        with: () => range
                    } as vscode.Range;
                }
                
                queryBlocks.push({
                    type: queryType,
                    content: cleanContent,
                    range,
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
        let skipFirstHttpLine = false;
        
        // For opensearch-api, check if the first non-empty line is an HTTP request line
        if (queryType === 'opensearch-api') {
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && this.HTTP_REQUEST_LINE_REGEX.test(trimmedLine)) {
                    skipFirstHttpLine = true;
                    break;
                }
                if (trimmedLine && !this.isMetadataComment(trimmedLine)) {
                    break;
                }
            }
        }
        
        let httpLineSkipped = false;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and metadata comments (but preserve regular comments)
            if (!trimmedLine) {
                continue;
            }
            
            // Skip metadata comments (like -- Description: ..., -- Method: ..., etc.)
            if (this.isMetadataComment(trimmedLine)) {
                continue;
            }
            
            // For opensearch-api, skip the first HTTP request line if present
            if (queryType === 'opensearch-api' && skipFirstHttpLine && !httpLineSkipped && this.HTTP_REQUEST_LINE_REGEX.test(trimmedLine)) {
                httpLineSkipped = true;
                continue;
            }
            
            // For all query types, preserve the line (including regular comments)
            queryLines.push(line);
        }
        
        return queryLines.join('\n').trim();
    }

    private static parseMetadata(content: string, queryType?: 'sql' | 'ppl' | 'opensearch-api'): QueryMetadata {
        const metadata: QueryMetadata = {};
        const lines = content.split('\n');
        
        // Only parse HTTP request lines for opensearch-api blocks
        if (queryType === 'opensearch-api') {
            // First, check for HTTP request line to extract method and endpoint
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Check for HTTP request line format (e.g., "GET /index/_search")
                const httpMatch = trimmedLine.match(this.HTTP_REQUEST_LINE_REGEX);
                if (httpMatch) {
                    const [, method, endpoint] = httpMatch;
                    metadata.method = method.toUpperCase();
                    metadata.endpoint = endpoint;
                    break; // Only process the first HTTP request line found
                }
                
                // Stop at the first non-empty, non-comment line that's not an HTTP request
                if (trimmedLine && !this.isMetadataComment(trimmedLine)) {
                    break;
                }
            }
        }
        
        // Then, parse metadata comments (these can override HTTP request line values)
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
                            // Metadata comments override HTTP request line
                            metadata.method = value.trim().toUpperCase();
                            break;
                        case 'endpoint':
                            // Metadata comments override HTTP request line
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
        const text = document.getText();
        const configBlocks: ConfigurationBlock[] = [];
        
        let match;
        const regex = new RegExp(this.CONFIG_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, , content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const config = this.parseConnectionOverrides(content);
            
            if (Object.keys(config).length > 0) {
                // Create range - handle test environment where vscode.Range might not be available
                let range: vscode.Range;
                try {
                    range = new vscode.Range(startPos, endPos);
                } catch {
                    // Fallback for test environment
                    range = {
                        start: startPos,
                        end: endPos,
                        contains: () => false,
                        intersection: () => undefined,
                        isEmpty: false,
                        isSingleLine: startPos.line === endPos.line,
                        isEqual: () => false,
                        union: () => range,
                        with: () => range
                    } as vscode.Range;
                }
                
                configBlocks.push({
                    config,
                    range,
                    position: match.index
                });
            }
        }
        
        return configBlocks;
    }

    /**
     * Parse connection override variables from configuration block content
     */
    private static parseConnectionOverrides(content: string): ConnectionOverrides {
        const overrides: ConnectionOverrides = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine) {
                continue;
            }
            
            const match = trimmedLine.match(this.CONFIG_VAR_REGEX);
            if (match) {
                const [, key, value] = match;
                
                switch (key.toLowerCase()) {
                    case 'endpoint':
                        overrides.endpoint = value;
                        break;
                    case 'auth_type':
                    case 'authtype':
                        if (!overrides.auth) {
                            overrides.auth = {};
                        }
                        const authType = value.toLowerCase();
                        if (['none', 'basic', 'apikey'].includes(authType)) {
                            overrides.auth.type = authType as 'none' | 'basic' | 'apikey';
                        }
                        break;
                    case 'username':
                        if (!overrides.auth) {
                            overrides.auth = {};
                        }
                        overrides.auth.username = value;
                        break;
                    case 'password':
                        if (!overrides.auth) {
                            overrides.auth = {};
                        }
                        overrides.auth.password = value;
                        break;
                    case 'api_key':
                    case 'apikey':
                        if (!overrides.auth) {
                            overrides.auth = {};
                        }
                        overrides.auth.apiKey = value;
                        break;
                    case 'timeout':
                        const timeoutValue = this.parseTimeout(value);
                        if (timeoutValue) {
                            overrides.timeout = timeoutValue;
                        }
                        break;
                }
            }
        }
        
        return overrides;
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
            }
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

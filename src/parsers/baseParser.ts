import * as vscode from 'vscode';
import { QueryBlock, QueryMetadata, ConfigurationBlock, QueryType } from '../types';

/**
 * Base interface for document parsers
 */
export interface IDocumentParser {
    /**
     * Parse a document and extract query blocks
     */
    parseDocument(document: vscode.TextDocument): QueryBlock[];
    
    /**
     * Find a query block at a specific position
     */
    findQueryBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): QueryBlock | null;
    
    /**
     * Parse configuration blocks from the document
     */
    parseConfigurationBlocks(document: vscode.TextDocument): ConfigurationBlock[];
}

/**
 * Common parsing utilities shared between parsers
 */
export class BaseParser {
    protected static readonly HTTP_REQUEST_LINE_REGEX = /^(GET|POST|PUT|DELETE|HEAD|PATCH)\s+([^\s]+)(?:\s+HTTP\/[\d.]+)?\s*$/i;
    
    /**
     * Extract clean query content from raw content
     */
    protected static extractQueryContent(
        content: string, 
        queryType: QueryType,
    ): string {
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
            
            // Skip empty lines
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
            
            queryLines.push(line);
        }
        
        return queryLines.join('\n').trim();
    }

    /**
     * Parse metadata from content
     */
    protected static parseMetadata(
        content: string, 
        queryType?: QueryType
    ): QueryMetadata {
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
                const metadataMatch = trimmedLine.match(new RegExp(`^--\\s*(\\w+):\\s*(.+)$`));
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
    
    /**
     * Check if a line is a metadata comment
     */
    protected static isMetadataComment(line: string): boolean {
        const lineToCheck = line.trim();
        
        // Only consider it a metadata comment if it matches specific metadata keys
        const metadataKeys = ['description', 'timeout', 'connection', 'method', 'endpoint'];
        const pattern = new RegExp(`^--\\s*(${metadataKeys.join('|')}):\\s*.+$`, 'i');
        return pattern.test(lineToCheck);
    }
    
    /**
     * Remove RST indentation from a line while preserving internal formatting
     */
    public static unindentRstLine(line: string): string {
        // RST code blocks require indentation, so we need to remove the leading spaces
        // But preserve internal formatting for JSON and other structured content
        return line.replace(/^   /, '');
    }
    
    /**
     * Parse timeout values like "30s", "5000ms", "2m", etc.
     */
    public static parseTimeout(value: string): number | null {
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
    
    /**
     * Create a VSCode range with fallback for test environments
     */
    protected static createRange(startPos: vscode.Position, endPos: vscode.Position): vscode.Range {
        try {
            return new vscode.Range(startPos, endPos);
        } catch {
            // Fallback for test environment
            return {
                start: startPos,
                end: endPos,
                contains: () => false,
                intersection: () => undefined,
                isEmpty: false,
                isSingleLine: startPos.line === endPos.line,
                isEqual: () => false,
                union: () => ({} as vscode.Range),
                with: () => ({} as vscode.Range)
            } as vscode.Range;
        }
    }
    
    /**
     * Parse connection override variables from configuration block content
     * 
     * Configuration blocks allow users to override connection settings like:
     * @endpoint = 'http://localhost:9200'
     * @auth_type = 'basic'
     * @username = 'user'
     * @password = 'pass'
     * @timeout = '30s'
     */
    public static parseConnectionOverrides(content: string): import('../types').ConnectionOverrides {
        const CONFIG_VAR_REGEX = /^@(\w+)\s*=\s*['"]([^'"]*)['"]\s*$/;
        const overrides: import('../types').ConnectionOverrides = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine) {
                continue;
            }
            
            const match = trimmedLine.match(CONFIG_VAR_REGEX);
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
}

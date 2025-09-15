import * as vscode from 'vscode';
import { QueryBlock, QueryMetadata, ConnectionOverrides, ConfigurationBlock } from './types';

// TypeScript interfaces for RST parsing
interface RstNode {
    type: string;
    directive?: string;
    children?: RstNode[];
    value?: string;
}

interface RstParser {
    parse(content: string): RstNode;
}

const restructured = require('restructured') as { default: RstParser };

export class DocumentParser {
    // Markdown patterns
    private static readonly MD_CODE_BLOCK_REGEX = /^```(sql|ppl|opensearch-api)\s*\n([\s\S]*?)^```/gm;
    private static readonly MD_CONFIG_BLOCK_REGEX = /^```(config|opensearch-config|connection)\s*\n([\s\S]*?)^```/gm;
    
    // RST patterns - capture all following content, boundary processing happens in extractQueryContent
    private static readonly RST_CODE_BLOCK_REGEX = /^\.\.\s+(code-block|sourcecode)::\s+(sql|ppl|opensearch-api)\s*\n([\s\S]*?)(?=^\S|\n\S|$)/gm;
    private static readonly RST_CONFIG_BLOCK_REGEX = /^\.\.\s+(code-block|sourcecode)::\s+(config|opensearch-config|connection)\s*\n([\s\S]*?)(?=^\S|\n\S|$)/gm;
    
    // Common patterns
    private static readonly METADATA_REGEX = /^(--|#)\s*(\w+):\s*(.+)$/gm;
    private static readonly CONFIG_VAR_REGEX = /^@(\w+)\s*=\s*['"]([^'"]*)['"]\s*$/;
    private static readonly HTTP_REQUEST_LINE_REGEX = /^(GET|POST|PUT|DELETE|HEAD|PATCH)\s+([^\s]+)(?:\s+HTTP\/[\d.]+)?\s*$/i;

    public static parseDocument(document: vscode.TextDocument): QueryBlock[] {
        const text = document.getText();
        const isRst = document.languageId === 'restructuredtext';
        
        if (isRst) {
            return this.parseRstDocument(text, document);
        } else {
            return this.parseMarkdownDocument(text, document);
        }
    }

    private static parseMarkdownDocument(text: string, document: vscode.TextDocument): QueryBlock[] {
        const queryBlocks: QueryBlock[] = [];
        
        let match;
        const regex = new RegExp(this.MD_CODE_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, language, content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const queryType = language.toLowerCase() as 'sql' | 'ppl' | 'opensearch-api';
            const cleanContent = this.extractQueryContent(content, queryType, false);
            const metadata = this.parseMetadata(content, queryType, false);
            
            // For opensearch-api, we need metadata even if content is empty
            if (cleanContent.trim() || (queryType === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                const range = this.createRange(startPos, endPos);
                
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

    private static parseRstDocument(text: string, document: vscode.TextDocument): QueryBlock[] {
        const queryBlocks: QueryBlock[] = [];
        
        try {
            // Parse RST document using the restructured library
            const parsed = restructured.default.parse(text);
            
            // Find all code-block directives
            const codeBlocks = this.findRstCodeBlocks(parsed);
            
            for (const block of codeBlocks) {
                const language = block.language;
                const content = block.content;
                
                // Check if this is a supported query type
                if (['sql', 'ppl', 'opensearch-api'].includes(language)) {
                    const queryType = language as 'sql' | 'ppl' | 'opensearch-api';
                    const cleanContent = this.extractQueryContent(content, queryType, true);
                    const metadata = this.parseMetadata(content, queryType, true);
                    
                    // For opensearch-api, we need metadata even if content is empty
                    if (cleanContent.trim() || (queryType === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                        // Calculate position in document for this block
                        const blockStart = this.findRstBlockPosition(text, block.language, block.content);
                        const startPos = document.positionAt(blockStart);
                        const endPos = document.positionAt(blockStart + block.content.length + 50); // Approximate end
                        
                        const range = this.createRange(startPos, endPos);
                        
                        queryBlocks.push({
                            type: queryType,
                            content: cleanContent,
                            range,
                            metadata
                        });
                    }
                }
            }
            
            // Return library results - don't fall back to regex
            return queryBlocks;
        } catch (error) {
            // Fallback to regex parsing if library parsing fails
            console.warn('RST library parsing failed, falling back to regex:', error);
            return this.parseRstDocumentWithRegex(text, document);
        }
    }

    private static parseRstDocumentWithRegex(text: string, document: vscode.TextDocument): QueryBlock[] {
        const queryBlocks: QueryBlock[] = [];
        
        let match;
        const regex = new RegExp(this.RST_CODE_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, , language, content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const queryType = language.toLowerCase() as 'sql' | 'ppl' | 'opensearch-api';
            const cleanContent = this.extractQueryContent(content, queryType, true);
            const metadata = this.parseMetadata(content, queryType, true);
            
            // For opensearch-api, we need metadata even if content is empty
            if (cleanContent.trim() || (queryType === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                const range = this.createRange(startPos, endPos);
                
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

    private static findRstCodeBlocks(node: RstNode): Array<{language: string, content: string}> {
        const blocks: Array<{language: string, content: string}> = [];
        
        if (node.type === 'directive' && node.directive === 'code-block' && node.children) {
            // First child is the language, remaining children are the content lines
            if (node.children.length >= 1) {
                const language = node.children[0].value || '';
                
                // Join all content children (skip the first which is the language)
                const contentParts = node.children.slice(1).map(child => child.value || '');
                const content = contentParts.join('\n');
                
                // Only add blocks for supported languages
                if (['sql', 'ppl', 'opensearch-api', 'config', 'opensearch-config', 'connection'].includes(language)) {
                    blocks.push({ language, content });
                }
            }
        }
        
        // Recursively search children
        if (node.children) {
            for (const child of node.children) {
                blocks.push(...this.findRstCodeBlocks(child));
            }
        }
        
        return blocks;
    }

    private static findRstBlockPosition(text: string, language: string, content: string): number {
        // Find the position of this specific code block in the text
        const directivePattern = new RegExp(`\\.\\.\\s+code-block::\\s+${language}\\s*\\n`, 'g');
        let match;
        
        // Get the first line of content to match against
        const firstContentLine = content.split('\n')[0].trim();
        
        // Find all directive matches and check which one is followed by our content
        while ((match = directivePattern.exec(text)) !== null) {
            const afterDirective = text.substring(match.index + match[0].length);
            
            // Look for the first line of content in the next few lines after the directive
            const nextLines = afterDirective.split('\n').slice(0, 5); // Check first 5 lines
            
            for (const line of nextLines) {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.includes(firstContentLine)) {
                    return match.index;
                }
                // If we hit a non-indented line that's not empty, this block is done
                if (line.length > 0 && !line.match(/^\s/)) {
                    break;
                }
            }
        }
        
        // Fallback: try to find the content directly in the text
        const contentIndex = text.indexOf(firstContentLine);
        if (contentIndex !== -1) {
            // Look backwards for the nearest code-block directive
            const beforeContent = text.substring(0, contentIndex);
            const lastDirectiveMatch = beforeContent.lastIndexOf(`.. code-block:: ${language}`);
            if (lastDirectiveMatch !== -1) {
                return lastDirectiveMatch;
            }
        }
        
        return 0;
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

    private static extractQueryContent(content: string, queryType: 'sql' | 'ppl' | 'opensearch-api', isRst: boolean): string {
        const lines = content.split('\n');
        const queryLines: string[] = [];
        let skipFirstHttpLine = false;
        
        // Note: For RST, the restructured library already handles indentation and gives us clean content
        // We don't need to filter lines based on indentation when using the library
        
        // For opensearch-api, check if the first non-empty line is an HTTP request line
        if (queryType === 'opensearch-api') {
            for (const line of lines) {
                const trimmedLine = isRst ? this.unindentRstLine(line) : line.trim();
                if (trimmedLine && this.HTTP_REQUEST_LINE_REGEX.test(trimmedLine)) {
                    skipFirstHttpLine = true;
                    break;
                }
                if (trimmedLine && !this.isMetadataComment(trimmedLine, isRst)) {
                    break;
                }
            }
        }
        
        let httpLineSkipped = false;
        
        for (const line of lines) {
            const trimmedLine = isRst ? this.unindentRstLine(line) : line.trim();
            
            // Skip empty lines and metadata comments (but preserve regular comments)
            if (!trimmedLine) {
                continue;
            }
            
            // Skip metadata comments (like -- Description: ..., -- Method: ..., etc.)
            if (this.isMetadataComment(trimmedLine, isRst)) {
                continue;
            }
            
            // For opensearch-api, skip the first HTTP request line if present
            if (queryType === 'opensearch-api' && skipFirstHttpLine && !httpLineSkipped && this.HTTP_REQUEST_LINE_REGEX.test(trimmedLine)) {
                httpLineSkipped = true;
                continue;
            }
            
            // For RST, preserve the unindented line; for markdown, preserve the original line
            if (isRst) {
                queryLines.push(trimmedLine);
            } else {
                queryLines.push(line);
            }
        }
        
        return queryLines.join('\n').trim();
    }

    private static parseMetadata(content: string, queryType?: 'sql' | 'ppl' | 'opensearch-api', isRst?: boolean): QueryMetadata {
        const metadata: QueryMetadata = {};
        const lines = content.split('\n');
        
        // Only parse HTTP request lines for opensearch-api blocks
        if (queryType === 'opensearch-api') {
            // First, check for HTTP request line to extract method and endpoint
            for (const line of lines) {
                const trimmedLine = isRst ? this.unindentRstLine(line) : line.trim();
                
                // Check for HTTP request line format (e.g., "GET /index/_search")
                const httpMatch = trimmedLine.match(this.HTTP_REQUEST_LINE_REGEX);
                if (httpMatch) {
                    const [, method, endpoint] = httpMatch;
                    metadata.method = method.toUpperCase();
                    metadata.endpoint = endpoint;
                    break; // Only process the first HTTP request line found
                }
                
                // Stop at the first non-empty, non-comment line that's not an HTTP request
                if (trimmedLine && !this.isMetadataComment(trimmedLine, isRst)) {
                    break;
                }
            }
        }
        
        // Then, parse metadata comments (these can override HTTP request line values)
        for (const line of lines) {
            const trimmedLine = isRst ? this.unindentRstLine(line) : line.trim();
            
            if (this.isMetadataComment(trimmedLine, isRst)) {
                const commentPrefix = isRst ? '#' : '--';
                const metadataMatch = trimmedLine.match(new RegExp(`^${commentPrefix === '#' ? '#' : '--'}\\s*(\\w+):\\s*(.+)$`));
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

    private static isMetadataComment(line: string, isRst?: boolean): boolean {
        const commentPrefix = isRst ? '#' : '--';
        return new RegExp(`^${commentPrefix === '#' ? '#' : '--'}\\s*\\w+:\\s*.+$`).test(line);
    }

    private static unindentRstLine(line: string): string {
        // RST code blocks require indentation, so we need to remove the leading spaces
        return line.replace(/^   /, '').trim();
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
        const isRst = document.languageId === 'restructuredtext';
        
        if (isRst) {
            return this.parseRstConfigurationBlocks(text, document);
        } else {
            return this.parseMarkdownConfigurationBlocks(text, document);
        }
    }

    private static parseMarkdownConfigurationBlocks(text: string, document: vscode.TextDocument): ConfigurationBlock[] {
        const configBlocks: ConfigurationBlock[] = [];
        
        let match;
        const regex = new RegExp(this.MD_CONFIG_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, , content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const config = this.parseConnectionOverrides(content, false);
            
            if (Object.keys(config).length > 0) {
                const range = this.createRange(startPos, endPos);
                
                configBlocks.push({
                    config,
                    range,
                    position: match.index
                });
            }
        }
        
        return configBlocks;
    }

    private static parseRstConfigurationBlocks(text: string, document: vscode.TextDocument): ConfigurationBlock[] {
        const configBlocks: ConfigurationBlock[] = [];
        
        let match;
        const regex = new RegExp(this.RST_CONFIG_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, , , content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const config = this.parseConnectionOverrides(content, true);
            
            if (Object.keys(config).length > 0) {
                const range = this.createRange(startPos, endPos);
                
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
    private static parseConnectionOverrides(content: string, isRst: boolean): ConnectionOverrides {
        const overrides: ConnectionOverrides = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = isRst ? this.unindentRstLine(line) : line.trim();
            
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

    private static createRange(startPos: vscode.Position, endPos: vscode.Position): vscode.Range {
        // Create range - handle test environment where vscode.Range might not be available
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
}

// Backward compatibility alias
export const MarkdownParser = DocumentParser;

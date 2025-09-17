import * as vscode from 'vscode';
import { QueryBlock, ConfigurationBlock, QueryType } from '../types';
import { BaseParser, IDocumentParser } from './baseParser';

// TypeScript interfaces for RST parsing
interface RstNode {
    type: string;
    directive?: string;
    children?: RstNode[];
    value?: string;
}

interface RstParserLib {
    parse(content: string): RstNode;
}

const restructured = require('restructured') as { default: RstParserLib };

/**
 * Parser for reStructuredText documents with code-block directives
 */
export class RstParser extends BaseParser implements IDocumentParser {
    public parseDocument(document: vscode.TextDocument): QueryBlock[] {
        const text = document.getText();
        
        // Parse RST document using the restructured library
        const parsed = restructured.default.parse(text);
        
        // Find all code-block directives
        const codeBlocks = this.findRstCodeBlocks(parsed);
        
        const queryBlocks: QueryBlock[] = [];
        
        for (const block of codeBlocks) {
            const language = block.language;
            const content = block.content;
            
            // Check if this is a supported query type (not configuration blocks)
            if (['sql', 'ppl', 'opensearch-api'].includes(language)) {
                const queryTypeString = language as QueryType;
                const queryType = queryTypeString as QueryType;
                
                // For RST, use custom content extraction that preserves HTTP lines but filters metadata comments
                const cleanContent = this.extractRstQueryContent(content, queryTypeString);
                
                const metadata = BaseParser.parseMetadata(content, queryTypeString);
                
                // Calculate position in document for this block
                const blockStart = this.findRstBlockPosition(text, block.language, block.content);
                const startPos = document.positionAt(blockStart);
                const endPos = document.positionAt(blockStart + block.content.length + 50); // Approximate end
                
                const range = BaseParser.createRange(startPos, endPos);
                
                // For opensearch-api, we need metadata even if content is empty
                if (cleanContent.trim() || (queryTypeString === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                    queryBlocks.push({
                        type: queryType,
                        content: cleanContent,
                        range,
                        metadata
                    });
                }
            }
        }
        
        return queryBlocks;
    }
    
    public findQueryBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): QueryBlock | null {
        const queryBlocks = this.parseDocument(document);
        
        for (const block of queryBlocks) {
            if (block.range.contains(position)) {
                return block;
            }
        }
        
        return null;
    }
    
    /**
     * Find RST code blocks using the parsed AST
     */
    private findRstCodeBlocks(node: RstNode): Array<{language: string, content: string}> {
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
    
    /**
     * Find the position of an RST code block in the document text
     */
    private findRstBlockPosition(text: string, language: string, content: string): number {
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
    
    public parseConfigurationBlocks(document: vscode.TextDocument): ConfigurationBlock[] {
        const text = document.getText();
        
        // Parse RST document using the restructured library
        const parsed = restructured.default.parse(text);
        
        // Find all code-block directives for configuration
        const codeBlocks = this.findRstCodeBlocks(parsed);
        
        const configBlocks: ConfigurationBlock[] = [];
        
        for (const block of codeBlocks) {
            const language = block.language;
            const content = block.content;
            
            // Check if this is a configuration block
            if (['config', 'opensearch-config', 'connection'].includes(language)) {
                const config = this.parseConnectionOverrides(content);
                
                if (Object.keys(config).length > 0) {
                    // Calculate position in document for this block
                    const blockStart = this.findRstBlockPosition(text, block.language, block.content);
                    const startPos = document.positionAt(blockStart);
                    const endPos = document.positionAt(blockStart + block.content.length + 50); // Approximate end
                    
                    const range = BaseParser.createRange(startPos, endPos);
                    
                    configBlocks.push({
                        config,
                        range,
                        position: blockStart
                    });
                }
            }
        }
        
        return configBlocks;
    }
    
    private parseConnectionOverrides(content: string) {
        return BaseParser.parseConnectionOverrides(content);
    }
    
    /**
     * Extract query content for RST blocks - filters metadata comments and HTTP lines for opensearch-api
     */
    private extractRstQueryContent(content: string, queryType: QueryType): string {
        const lines = content.split('\n');
        const queryLines: string[] = [];
        let skipFirstHttpLine = false;
        
        // For opensearch-api, check if the first non-empty line is an HTTP request line
        if (queryType === 'opensearch-api') {
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && (BaseParser as any).HTTP_REQUEST_LINE_REGEX.test(trimmedLine)) {
                    skipFirstHttpLine = true;
                    break;
                }
                if (trimmedLine && !(BaseParser as any).isMetadataComment(trimmedLine)) {
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
            if ((BaseParser as any).isMetadataComment(trimmedLine)) {
                continue;
            }
            
            // For opensearch-api, skip the first HTTP request line if present
            if (queryType === 'opensearch-api' && skipFirstHttpLine && !httpLineSkipped && (BaseParser as any).HTTP_REQUEST_LINE_REGEX.test(trimmedLine)) {
                httpLineSkipped = true;
                continue;
            }
            
            queryLines.push(line);
        }
        
        return queryLines.join('\n').trim();
    }
}

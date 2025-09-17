import * as vscode from 'vscode';
import { QueryBlock, ConfigurationBlock, QueryType } from '../types';
import { BaseParser, IDocumentParser } from './baseParser';

/**
 * Parser for Markdown documents with code fences
 */
export class MarkdownParser extends BaseParser implements IDocumentParser {
    private static readonly CODE_BLOCK_REGEX = /^```(sql|ppl|opensearch-api)\s*\n([\s\S]*?)^```/gm;
    private static readonly CONFIG_BLOCK_REGEX = /^```(config|opensearch-config|connection)\s*\n([\s\S]*?)^```/gm;
    
    public parseDocument(document: vscode.TextDocument): QueryBlock[] {
        const text = document.getText();
        const queryBlocks: QueryBlock[] = [];
        
        let match;
        const regex = new RegExp(MarkdownParser.CODE_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, language, content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const queryTypeString = language.toLowerCase() as QueryType;
            const queryType = queryTypeString as QueryType;
            const cleanContent = BaseParser.extractQueryContent(content, queryTypeString);
            const metadata = BaseParser.parseMetadata(content, queryTypeString);
            
            // For opensearch-api, we need metadata even if content is empty
            if (cleanContent.trim() || (queryTypeString === 'opensearch-api' && (metadata.method || metadata.endpoint))) {
                const range = BaseParser.createRange(startPos, endPos);
                
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
    
    public findQueryBlockAtPosition(document: vscode.TextDocument, position: vscode.Position): QueryBlock | null {
        const queryBlocks = this.parseDocument(document);
        
        for (const block of queryBlocks) {
            if (block.range.contains(position)) {
                return block;
            }
        }
        
        return null;
    }
    
    public parseConfigurationBlocks(document: vscode.TextDocument): ConfigurationBlock[] {
        const text = document.getText();
        const configBlocks: ConfigurationBlock[] = [];
        
        let match;
        const regex = new RegExp(MarkdownParser.CONFIG_BLOCK_REGEX);
        
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, , content] = match;
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);
            
            const config = this.parseConnectionOverrides(content);
            
            if (Object.keys(config).length > 0) {
                const range = BaseParser.createRange(startPos, endPos);
                
                configBlocks.push({
                    config,
                    range,
                    position: match.index
                });
            }
        }
        
        return configBlocks;
    }
    
    private parseConnectionOverrides(content: string) {
        return BaseParser.parseConnectionOverrides(content);
    }
}

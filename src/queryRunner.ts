import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { MarkdownParser } from './markdownParser';
import { QueryResult, QueryBlock, OpenSearchResponse, DisplayMode, ConnectionOverrides } from './types';
import { QueryExecutionEngine, QueryExecutionContext } from './utils/queryExecutor';
import { ResponseProcessor } from './utils/responseProcessor';

export class QueryRunner {
    private connectionManager: ConnectionManager;

    constructor(connectionManager: ConnectionManager) {
        this.connectionManager = connectionManager;
    }

    public async executeQuery(
        query: string, 
        queryType: 'sql' | 'ppl' | 'opensearch-api', 
        timeout?: number,
        metadata?: any,
        connectionOverrides?: ConnectionOverrides
    ): Promise<QueryResult> {
        const context = QueryExecutionEngine.createContext(query, queryType, timeout, metadata, connectionOverrides);
        
        // Pre-validation
        const validationError = QueryExecutionEngine.validateQuery(context);
        if (validationError) {
            return validationError;
        }

        return QueryExecutionEngine.executeWithErrorHandling(
            context,
            async (ctx) => {
                // Execute based on query type
                if (ctx.queryType === 'opensearch-api') {
                    return await this.connectionManager.executeApiOperationWithOverrides(
                        ctx.metadata.method, 
                        ctx.metadata.endpoint, 
                        ctx.query,
                        ctx.connectionOverrides
                    );
                } else {
                    return await this.connectionManager.executeQueryWithOverrides(
                        ctx.query, 
                        ctx.queryType, 
                        ctx.connectionOverrides
                    );
                }
            },
            (response, executionTime, queryType) => ResponseProcessor.processQueryResponse(response, executionTime, queryType)
        );
    }

    public async executeQueryFromBlock(queryBlock: QueryBlock): Promise<QueryResult> {
        const timeout = queryBlock.metadata?.timeout;
        return this.executeQuery(
            queryBlock.content, 
            queryBlock.type, 
            timeout, 
            queryBlock.metadata,
            queryBlock.connectionOverrides
        );
    }

    public async executeExplainQuery(
        query: string, 
        queryType: 'sql' | 'ppl', 
        timeout?: number,
        connectionOverrides?: ConnectionOverrides
    ): Promise<QueryResult> {
        const context = QueryExecutionEngine.createContext(query, queryType, timeout, undefined, connectionOverrides);
        
        // Pre-validation for explain queries
        const validationError = QueryExecutionEngine.validateExplainQuery(context);
        if (validationError) {
            return validationError;
        }

        return QueryExecutionEngine.executeWithErrorHandling(
            context,
            async (ctx) => {
                return await this.connectionManager.executeExplainQueryWithOverrides(
                    ctx.query, 
                    ctx.queryType as 'sql' | 'ppl', 
                    ctx.connectionOverrides
                );
            },
            (response, executionTime, queryType) => ResponseProcessor.processQueryResponse(response, executionTime, queryType)
        );
    }

    public async executeExplainQueryFromBlock(queryBlock: QueryBlock): Promise<QueryResult> {
        if (queryBlock.type !== 'sql' && queryBlock.type !== 'ppl') {
            return {
                success: false,
                error: 'Explain is only supported for SQL and PPL queries',
                executionTime: 0
            };
        }

        const timeout = queryBlock.metadata?.timeout;
        return this.executeExplainQuery(
            queryBlock.content, 
            queryBlock.type, 
            timeout,
            queryBlock.connectionOverrides
        );
    }

    public async executeQueryAtPosition(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): Promise<QueryResult | null> {
        const queryBlock = MarkdownParser.findQueryBlockAtPositionWithOverrides(document, position);
        
        if (!queryBlock) {
            vscode.window.showWarningMessage('No query block found at cursor position');
            return null;
        }

        return this.executeQueryFromBlock(queryBlock);
    }

    /**
     * Execute query at position with enhanced override support
     */
    public async executeQueryAtPositionWithOverrides(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): Promise<QueryResult | null> {
        const queryBlocks = MarkdownParser.parseDocumentWithOverrides(document);
        
        for (const block of queryBlocks) {
            if (block.range.contains(position)) {
                return this.executeQueryFromBlock(block);
            }
        }
        
        vscode.window.showWarningMessage('No query block found at cursor position');
        return null;
    }

    public formatResultForDisplay(result: QueryResult, format: 'table' | 'json' = 'table'): string {
        return ResponseProcessor.formatResultForDisplay(result, format);
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

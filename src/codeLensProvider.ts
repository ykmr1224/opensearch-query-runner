import * as vscode from 'vscode';
import { DocumentParser } from './documentParser';

export class OpenSearchCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('opensearch.enableCodeLens')) {
                this._onDidChangeCodeLenses.fire();
            }
        });
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        // Check if CodeLens is enabled
        const config = vscode.workspace.getConfiguration('opensearch');
        if (!config.get('enableCodeLens', true)) {
            return [];
        }

        // Only provide CodeLens for markdown and RST files
        if (document.languageId !== 'markdown' && document.languageId !== 'restructuredtext') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const queryBlocks = DocumentParser.parseDocumentWithOverrides(document);

        for (const queryBlock of queryBlocks) {
            // Create CodeLens at the start of each query block
            const range = new vscode.Range(
                queryBlock.range.start.line,
                0,
                queryBlock.range.start.line,
                0
            );

            // Add "Run in Tab" command (now first)
            const runInTabLens = new vscode.CodeLens(range, {
                title: '$(window) Run',
                command: 'opensearch-query.runQueryInTab',
                arguments: [document.uri, queryBlock.range.start]
            });

            // Add "Run Inline" command (now second)
            const runInlineLens = new vscode.CodeLens(range, {
                title: '$(output) Inline',
                command: 'opensearch-query.runQueryInline',
                arguments: [document.uri, queryBlock.range.start]
            });

            codeLenses.push(runInTabLens, runInlineLens);
        }

        return codeLenses;
    }

    public resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken
    ): vscode.CodeLens | Thenable<vscode.CodeLens> {
        return codeLens;
    }


    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
}

export class OpenSearchCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] | Thenable<vscode.CodeAction[]> {
        // Only provide code actions for markdown and RST files
        if (document.languageId !== 'markdown' && document.languageId !== 'restructuredtext') {
            return [];
        }

        const actions: vscode.CodeAction[] = [];
        const position = range.start;
        const queryBlock = DocumentParser.findQueryBlockAtPositionWithOverrides(document, position);

        if (queryBlock) {
            // Add "Run Query" action
            const runAction = new vscode.CodeAction(
                'Run OpenSearch Query',
                vscode.CodeActionKind.Empty
            );
            runAction.command = {
                title: 'Run Query',
                command: 'opensearch-query.runQuery',
                arguments: [document.uri, position]
            };
            actions.push(runAction);

            // Add "Run Inline" action
            const runInlineAction = new vscode.CodeAction(
                'Run Query (Inline Results)',
                vscode.CodeActionKind.Empty
            );
            runInlineAction.command = {
                title: 'Run Query Inline',
                command: 'opensearch-query.runQueryInline',
                arguments: [document.uri, position]
            };
            actions.push(runInlineAction);

            // Add "Run in Tab" action
            const runInTabAction = new vscode.CodeAction(
                'Run Query (Separate Tab)',
                vscode.CodeActionKind.Empty
            );
            runInTabAction.command = {
                title: 'Run Query in Tab',
                command: 'opensearch-query.runQueryInTab',
                arguments: [document.uri, position]
            };
            actions.push(runInTabAction);

            // Add validation action if query is invalid
            const validation = DocumentParser.validateQuery(queryBlock.content, queryBlock.type, queryBlock.metadata);
            if (!validation.valid) {
                const validationAction = new vscode.CodeAction(
                    `Fix Query: ${validation.error}`,
                    vscode.CodeActionKind.QuickFix
                );
                validationAction.isPreferred = true;
                actions.push(validationAction);
            }

            // Add format action
            const formatAction = new vscode.CodeAction(
                'Format Query',
                vscode.CodeActionKind.SourceFixAll
            );
            formatAction.command = {
                title: 'Format Query',
                command: 'opensearch-query.formatQuery',
                arguments: [document.uri, position]
            };
            actions.push(formatAction);
        }

        return actions;
    }
}

export class OpenSearchHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.Hover | Thenable<vscode.Hover> | null {
        // Only provide hover for markdown and RST files
        if (document.languageId !== 'markdown' && document.languageId !== 'restructuredtext') {
            return null;
        }

        const queryBlock = DocumentParser.findQueryBlockAtPositionWithOverrides(document, position);
        if (!queryBlock) {
            return null;
        }

        const contents: vscode.MarkdownString[] = [];

        // Add query type info
        const typeInfo = new vscode.MarkdownString();
        typeInfo.appendMarkdown(`**${queryBlock.type.toUpperCase()} Query**\n\n`);
        
        if (queryBlock.type === 'sql') {
            typeInfo.appendMarkdown('OpenSearch SQL query - executes against `/_plugins/_sql` endpoint\n\n');
        } else if (queryBlock.type === 'ppl') {
            typeInfo.appendMarkdown('OpenSearch PPL query - executes against `/_plugins/_ppl` endpoint\n\n');
        } else if (queryBlock.type === 'opensearch-api') {
            typeInfo.appendMarkdown('OpenSearch REST API operation - executes direct HTTP requests\n\n');
            if (queryBlock.metadata?.method && queryBlock.metadata?.endpoint) {
                typeInfo.appendMarkdown(`**${queryBlock.metadata.method}** \`${queryBlock.metadata.endpoint}\`\n\n`);
            }
        }

        contents.push(typeInfo);

        // Add connection override info
        if (queryBlock.connectionOverrides) {
            const overrideInfo = new vscode.MarkdownString();
            overrideInfo.appendMarkdown('**Connection Overrides:**\n\n');
            
            if (queryBlock.connectionOverrides.endpoint) {
                overrideInfo.appendMarkdown(`- Endpoint: \`${queryBlock.connectionOverrides.endpoint}\`\n`);
            }
            if (queryBlock.connectionOverrides.auth?.type) {
                overrideInfo.appendMarkdown(`- Auth Type: \`${queryBlock.connectionOverrides.auth.type}\`\n`);
            }
            if (queryBlock.connectionOverrides.timeout) {
                overrideInfo.appendMarkdown(`- Timeout: \`${queryBlock.connectionOverrides.timeout}ms\`\n`);
            }
            
            contents.push(overrideInfo);
        }

        // Add metadata info
        if (queryBlock.metadata && Object.keys(queryBlock.metadata).length > 0) {
            const metadataInfo = new vscode.MarkdownString();
            metadataInfo.appendMarkdown('**Metadata:**\n\n');
            
            if (queryBlock.metadata.connection) {
                metadataInfo.appendMarkdown(`- Connection: \`${queryBlock.metadata.connection}\`\n`);
            }
            if (queryBlock.metadata.timeout) {
                metadataInfo.appendMarkdown(`- Timeout: \`${queryBlock.metadata.timeout}ms\`\n`);
            }
            if (queryBlock.metadata.description) {
                metadataInfo.appendMarkdown(`- Description: ${queryBlock.metadata.description}\n`);
            }
            
            contents.push(metadataInfo);
        }

        // Add validation info
        const validation = DocumentParser.validateQuery(queryBlock.content, queryBlock.type, queryBlock.metadata);
        const validationInfo = new vscode.MarkdownString();
        
        if (validation.valid) {
            validationInfo.appendMarkdown('✅ **Query is valid**\n\n');
        } else {
            validationInfo.appendMarkdown(`❌ **Query validation failed:** ${validation.error}\n\n`);
        }
        
        contents.push(validationInfo);

        // Add quick actions
        const actionsInfo = new vscode.MarkdownString();
        actionsInfo.appendMarkdown('**Quick Actions:**\n\n');
        actionsInfo.appendMarkdown('- Click CodeLens above to run query\n');
        actionsInfo.appendMarkdown('- Use `Ctrl+Shift+P` → "OpenSearch: Run Query"\n');
        actionsInfo.appendMarkdown('- Right-click for context menu options\n');
        
        contents.push(actionsInfo);

        return new vscode.Hover(contents, queryBlock.range);
    }
}

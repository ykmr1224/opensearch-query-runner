import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkdownParser } from '../markdownParser';

// Mock vscode.Range constructor
const mockRange = (startLine: number, startChar: number, endLine: number, endChar: number) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    contains: () => false,
    intersection: () => undefined,
    isEmpty: false,
    isSingleLine: startLine === endLine,
    isEqual: () => false,
    union: () => mockRange(0, 0, 0, 0),
    with: () => mockRange(0, 0, 0, 0)
} as unknown as vscode.Range);

suite('Configuration Blocks Test Suite', () => {
    test('Parse basic configuration block', () => {
        const content = `# Test Document

\`\`\`config
@endpoint = 'http://localhost:9200'
@auth_type = 'basic'
@username = 'admin'
@password = 'secret'
\`\`\`

\`\`\`sql
SELECT * FROM test_index LIMIT 10
\`\`\`
`;

        // Create a mock document
        const document = {
            getText: () => content,
            positionAt: (offset: number) => {
                // Simple mock that calculates line/character from offset
                const lines = content.substring(0, offset).split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return { line, character } as vscode.Position;
            }
        } as vscode.TextDocument;

        const configBlocks = MarkdownParser.parseConfigurationBlocks(document);
        
        assert.strictEqual(configBlocks.length, 1);
        assert.strictEqual(configBlocks[0].config.endpoint, 'http://localhost:9200');
        assert.strictEqual(configBlocks[0].config.auth?.type, 'basic');
        assert.strictEqual(configBlocks[0].config.auth?.username, 'admin');
        assert.strictEqual(configBlocks[0].config.auth?.password, 'secret');
    });

    test('Parse document with overrides', () => {
        const content = `# Test Document

\`\`\`config
@endpoint = 'http://localhost:9200'
@auth_type = 'none'
\`\`\`

\`\`\`sql
-- Description: First query
SELECT * FROM test_index LIMIT 5
\`\`\`

\`\`\`config
@endpoint = 'http://production:9200'
@auth_type = 'apikey'
@api_key = 'test-key'
\`\`\`

\`\`\`sql
-- Description: Second query
SELECT * FROM prod_index LIMIT 10
\`\`\`
`;

        // Create a mock document
        const document = {
            getText: () => content,
            positionAt: (offset: number) => {
                const lines = content.substring(0, offset).split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return { line, character } as vscode.Position;
            }
        } as vscode.TextDocument;

        const queryBlocks = MarkdownParser.parseDocumentWithOverrides(document);
        
        assert.strictEqual(queryBlocks.length, 2);
        
        // First query should use first config
        assert.strictEqual(queryBlocks[0].connectionOverrides?.endpoint, 'http://localhost:9200');
        assert.strictEqual(queryBlocks[0].connectionOverrides?.auth?.type, 'none');
        
        // Second query should use second config
        assert.strictEqual(queryBlocks[1].connectionOverrides?.endpoint, 'http://production:9200');
        assert.strictEqual(queryBlocks[1].connectionOverrides?.auth?.type, 'apikey');
        assert.strictEqual(queryBlocks[1].connectionOverrides?.auth?.apiKey, 'test-key');
    });

    test('Validate connection overrides', () => {
        // Valid configuration
        const validConfig = {
            endpoint: 'http://localhost:9200',
            auth: {
                type: 'basic' as const,
                username: 'admin',
                password: 'secret'
            },
            timeout: 30000
        };

        const validResult = MarkdownParser.validateConnectionOverrides(validConfig);
        assert.strictEqual(validResult.valid, true);

        // Invalid endpoint
        const invalidEndpoint = {
            endpoint: 'not-a-url'
        };

        const invalidResult = MarkdownParser.validateConnectionOverrides(invalidEndpoint);
        assert.strictEqual(invalidResult.valid, false);
        assert.ok(invalidResult.error?.includes('Invalid endpoint URL'));

        // Missing password for basic auth
        const missingPassword = {
            auth: {
                type: 'basic' as const,
                username: 'admin'
            }
        };

        const missingPasswordResult = MarkdownParser.validateConnectionOverrides(missingPassword);
        assert.strictEqual(missingPasswordResult.valid, false);
        assert.ok(missingPasswordResult.error?.includes('Basic auth requires both username and password'));
    });

    test('Parse different configuration block types', () => {
        const content = `
\`\`\`opensearch-config
@endpoint = 'http://test1:9200'
\`\`\`

\`\`\`connection
@endpoint = 'http://test2:9200'
\`\`\`

\`\`\`config
@endpoint = 'http://test3:9200'
\`\`\`
`;

        const document = {
            getText: () => content,
            positionAt: (offset: number) => {
                const lines = content.substring(0, offset).split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return { line, character } as vscode.Position;
            }
        } as vscode.TextDocument;

        const configBlocks = MarkdownParser.parseConfigurationBlocks(document);
        
        assert.strictEqual(configBlocks.length, 3);
        assert.strictEqual(configBlocks[0].config.endpoint, 'http://test1:9200');
        assert.strictEqual(configBlocks[1].config.endpoint, 'http://test2:9200');
        assert.strictEqual(configBlocks[2].config.endpoint, 'http://test3:9200');
    });

    test('Parse timeout values', () => {
        const content = `
\`\`\`config
@timeout = '30s'
\`\`\`
`;

        const document = {
            getText: () => content,
            positionAt: (offset: number) => {
                const lines = content.substring(0, offset).split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return { line, character } as vscode.Position;
            }
        } as vscode.TextDocument;

        const configBlocks = MarkdownParser.parseConfigurationBlocks(document);
        
        assert.strictEqual(configBlocks.length, 1);
        assert.strictEqual(configBlocks[0].config.timeout, 30000); // 30 seconds in milliseconds
    });
});

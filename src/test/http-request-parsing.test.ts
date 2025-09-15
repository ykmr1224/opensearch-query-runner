import * as assert from 'assert';
import * as vscode from 'vscode';
import { DocumentParser } from '../documentParser';

suite('HTTP Request Line Parsing Tests', () => {
    
    // Helper function to create a mock document
    function createMockDocument(content: string): vscode.TextDocument {
        return {
            getText: () => content,
            positionAt: (offset: number) => {
                const lines = content.substring(0, offset).split('\n');
                const line = lines.length - 1;
                const character = lines[lines.length - 1].length;
                return { line, character } as vscode.Position;
            }
        } as vscode.TextDocument;
    }

    test('Should parse simple GET request', () => {
        const content = `
\`\`\`opensearch-api
GET /sample_logs/_search
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'opensearch-api');
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_search');
        
        // Content should not include the HTTP request line
        const expectedContent = `{
  "query": {
    "match_all": {}
  }
}`;
        assert.strictEqual(blocks[0].content.trim(), expectedContent.trim());
    });

    test('Should parse POST request with body', () => {
        const content = `
\`\`\`opensearch-api
POST /sample_logs/_doc
{
  "timestamp": "2024-01-15T10:00:00Z",
  "level": "INFO",
  "message": "Test log entry"
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'POST');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_doc');
        
        const expectedContent = `{
  "timestamp": "2024-01-15T10:00:00Z",
  "level": "INFO",
  "message": "Test log entry"
}`;
        assert.strictEqual(blocks[0].content.trim(), expectedContent.trim());
    });

    test('Should parse PUT request for index creation', () => {
        const content = `
\`\`\`opensearch-api
PUT /sample_logs
{
  "mappings": {
    "properties": {
      "timestamp": { "type": "date" }
    }
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'PUT');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs');
    });

    test('Should parse DELETE request without body', () => {
        const content = `
\`\`\`opensearch-api
DELETE /sample_logs/_doc/123
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'DELETE');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_doc/123');
        assert.strictEqual(blocks[0].content.trim(), '');
    });

    test('Should handle HTTP request line with metadata comments', () => {
        const content = `
\`\`\`opensearch-api
GET /sample_logs/_search
-- Description: Search for all documents
-- Timeout: 30s
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_search');
        assert.strictEqual(blocks[0].metadata?.description, 'Search for all documents');
        assert.strictEqual(blocks[0].metadata?.timeout, 30000);
    });

    test('Should allow metadata comments to override HTTP request line', () => {
        const content = `
\`\`\`opensearch-api
GET /sample_logs/_search
-- Method: POST
-- Endpoint: /different_index/_search
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        // Metadata comments should override HTTP request line
        assert.strictEqual(blocks[0].metadata?.method, 'POST');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/different_index/_search');
    });

    test('Should handle bulk operations with HTTP request line', () => {
        const content = `
\`\`\`opensearch-api
POST /_bulk
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:00:00Z", "level": "INFO", "message": "Log 1" }
{ "index": { "_index": "sample_logs" } }
{ "timestamp": "2024-01-15T10:05:00Z", "level": "ERROR", "message": "Log 2" }
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'POST');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/_bulk');
        
        // Content should contain the bulk data without the HTTP request line
        const lines = blocks[0].content.split('\n');
        assert.strictEqual(lines.length, 4);
        assert.strictEqual(lines[0].trim(), '{ "index": { "_index": "sample_logs" } }');
    });

    test('Should maintain backwards compatibility with metadata-only format', () => {
        const content = `
\`\`\`opensearch-api
-- Method: GET
-- Endpoint: /sample_logs/_search
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_search');
    });

    test('Should handle complex URLs with query parameters', () => {
        const content = `
\`\`\`opensearch-api
GET /sample_logs/_search?size=10&from=0&sort=timestamp:desc
{
  "query": {
    "match": {
      "level": "ERROR"
    }
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_search?size=10&from=0&sort=timestamp:desc');
    });

    test('Should validate HTTP request line format', () => {
        // Valid request
        const validContent = `
\`\`\`opensearch-api
GET /sample_logs/_search
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(validContent);
        const blocks = DocumentParser.parseDocument(document);
        const validation = DocumentParser.validateQuery(blocks[0].content, 'opensearch-api', blocks[0].metadata);
        
        assert.strictEqual(validation.valid, true);
    });

    test('Should handle case-insensitive HTTP methods', () => {
        const content = `
\`\`\`opensearch-api
get /sample_logs/_search
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_search');
    });

    test('Should handle PATCH method', () => {
        const content = `
\`\`\`opensearch-api
PATCH /sample_logs/_doc/123
{
  "doc": {
    "level": "WARN"
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'PATCH');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_doc/123');
    });

    test('Should ignore HTTP version in request line', () => {
        const content = `
\`\`\`opensearch-api
GET /sample_logs/_search HTTP/1.1
{
  "query": {
    "match_all": {}
  }
}
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/sample_logs/_search');
    });

    test('Should not parse HTTP request line in non-opensearch-api blocks', () => {
        const content = `
\`\`\`sql
GET /sample_logs/_search
SELECT * FROM sample_logs
\`\`\`
        `;
        
        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'sql');
        // Should include the GET line as part of the content for SQL blocks
        assert.strictEqual(blocks[0].content.includes('GET /sample_logs/_search'), true);
        assert.strictEqual(blocks[0].metadata?.method, undefined);
        assert.strictEqual(blocks[0].metadata?.endpoint, undefined);
    });
});

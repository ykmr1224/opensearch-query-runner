import * as assert from 'assert';
import * as vscode from 'vscode';
import { RstParser } from '../parsers/rstParser';

suite('RST Formatting Tests', () => {
    test('should preserve JSON formatting in RST code blocks', () => {
        const rstContent = `
.. code-block:: opensearch-api

   POST /logs-2024/_doc
   # Description: Index a new log entry
   {
     "timestamp": "2024-01-15T10:00:00Z",
     "level": "INFO",
     "message": "Application started successfully"
   }
`;

        // Create a mock document
        const mockDocument = {
            getText: () => rstContent,
            positionAt: (offset: number) => new vscode.Position(0, 0),
            languageId: 'restructuredtext'
        } as vscode.TextDocument;

        const parser = new RstParser();
        const queryBlocks = parser.parseDocument(mockDocument);

        assert.strictEqual(queryBlocks.length, 1, 'Should find one query block');
        
        const block = queryBlocks[0];
        assert.strictEqual(block.type, 'opensearch-api', 'Should be opensearch-api type');
        
        // Check that JSON formatting is preserved
        const content = block.content;
        console.log('Extracted content:', JSON.stringify(content));
        
        // The content should preserve the indentation of the JSON
        assert.ok(content.includes('  "timestamp"'), 'Should preserve JSON indentation for timestamp');
        assert.ok(content.includes('  "level"'), 'Should preserve JSON indentation for level');
        assert.ok(content.includes('  "message"'), 'Should preserve JSON indentation for message');
        
        // Should preserve the RST comment in the final content (hash comments are not metadata comments)
        assert.ok(content.includes('# Description:'), 'Should include hash comments in content');
        
        // Should NOT have the HTTP method line (it should be in metadata only)
        assert.ok(!content.includes('POST /logs-2024/_doc'), 'Should not include HTTP method line in content');
        
        // But metadata should have the HTTP method info
        assert.strictEqual(block.metadata?.method, 'POST', 'Should have method in metadata');
        assert.strictEqual(block.metadata?.endpoint, '/logs-2024/_doc', 'Should have endpoint in metadata');
    });

    test('should preserve complex JSON structure formatting', () => {
        const rstContent = `
.. code-block:: opensearch-api

   GET /logs-2024/_search
   # Description: Search for error logs
   {
     "query": {
       "bool": {
         "must": [
           {
             "match": {
               "level": "ERROR"
             }
           }
         ]
       }
     },
     "sort": [
       {
         "timestamp": {
           "order": "desc"
         }
       }
     ]
   }
`;

        const mockDocument = {
            getText: () => rstContent,
            positionAt: (offset: number) => new vscode.Position(0, 0),
            languageId: 'restructuredtext'
        } as vscode.TextDocument;

        const parser = new RstParser();
        const queryBlocks = parser.parseDocument(mockDocument);

        assert.strictEqual(queryBlocks.length, 1, 'Should find one query block');
        
        const block = queryBlocks[0];
        const content = block.content;
        console.log('Complex JSON content:', JSON.stringify(content));
        
        // Check nested indentation is preserved
        assert.ok(content.includes('  "query"'), 'Should preserve top-level indentation');
        assert.ok(content.includes('    "bool"'), 'Should preserve nested indentation');
        assert.ok(content.includes('      "must"'), 'Should preserve deeper nested indentation');
        assert.ok(content.includes('        "match"'), 'Should preserve deepest nested indentation');
    });
});

import * as assert from 'assert';
import * as vscode from 'vscode';
import { DocumentParser } from '../documentParser';

suite('RST Document Parsing Tests', () => {
    
    // Helper function to create mock document
    function createMockDocument(content: string, languageId: string = 'restructuredtext'): vscode.TextDocument {
        const lines = content.split('\n');
        return {
            getText: () => content,
            languageId: languageId,
            lineCount: lines.length,
            lineAt: (line: number) => ({
                text: lines[line] || '',
                range: {
                    start: { line, character: 0 },
                    end: { line, character: (lines[line] || '').length }
                }
            }),
            positionAt: (offset: number) => {
                const beforeOffset = content.substring(0, offset);
                const linesBefore = beforeOffset.split('\n');
                const line = linesBefore.length - 1;
                const character = linesBefore[linesBefore.length - 1].length;
                return { line, character } as vscode.Position;
            }
        } as vscode.TextDocument;
    }

    test('Parse basic RST SQL block', () => {
        const content = `Simple RST Test
===============

SQL Test
--------

.. code-block:: sql

   SELECT * FROM test_table
   WHERE id > 100
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'sql');
        assert.ok(blocks[0].content.includes('SELECT * FROM test_table'));
        assert.ok(blocks[0].content.includes('WHERE id > 100'));
    });

    test('Parse basic RST PPL block', () => {
        const content = `PPL Test
========

.. code-block:: ppl

   source=logs 
   | where level="ERROR" 
   | head 10
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'ppl');
        assert.ok(blocks[0].content.includes('source=logs'));
        assert.ok(blocks[0].content.includes('| where level="ERROR"'));
    });

    test('Parse RST OpenSearch API block', () => {
        const content = `API Test
========

.. code-block:: opensearch-api

   GET /test-index/_search
   {
     "query": {
       "match_all": {}
     }
   }
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'opensearch-api');
        // HTTP request line should be filtered out from content
        assert.ok(!blocks[0].content.includes('GET /test-index/_search'));
        assert.ok(blocks[0].content.includes('"match_all"'));
        // But should be in metadata
        assert.strictEqual(blocks[0].metadata?.method, 'GET');
        assert.strictEqual(blocks[0].metadata?.endpoint, '/test-index/_search');
    });

    test('Parse multiple RST blocks', () => {
        const content = `Multiple Blocks Test
===================

SQL Block
---------

.. code-block:: sql

   SELECT COUNT(*) FROM logs

PPL Block
---------

.. code-block:: ppl

   source=logs | stats count()

API Block
---------

.. code-block:: opensearch-api

   GET /_cluster/health
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 3);
        assert.strictEqual(blocks[0].type, 'sql');
        assert.strictEqual(blocks[1].type, 'ppl');
        assert.strictEqual(blocks[2].type, 'opensearch-api');
        
        assert.ok(blocks[0].content.includes('SELECT COUNT(*)'));
        assert.ok(blocks[1].content.includes('source=logs'));
        // HTTP request line should be filtered out from opensearch-api content
        assert.ok(!blocks[2].content.includes('GET /_cluster/health'));
        // But should be in metadata
        assert.strictEqual(blocks[2].metadata?.method, 'GET');
        assert.strictEqual(blocks[2].metadata?.endpoint, '/_cluster/health');
    });

    test('Parse RST blocks with comments', () => {
        const content = `RST with Comments
================

.. code-block:: sql

   -- Description: Count all records
   -- Timeout: 30s
   SELECT COUNT(*) FROM test_table

.. code-block:: ppl

   -- Description: Analyze log levels
   source=logs | stats count() by level
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 2);
        
        // Check that metadata comments are filtered out from content but metadata is parsed
        assert.ok(!blocks[0].content.includes('-- Description: Count all records'));
        assert.ok(!blocks[0].content.includes('-- Timeout: 30s'));
        assert.ok(!blocks[1].content.includes('-- Description: Analyze log levels'));
        
        // But the actual query content should be preserved
        assert.ok(blocks[0].content.includes('SELECT COUNT(*) FROM test_table'));
        assert.ok(blocks[1].content.includes('source=logs | stats count() by level'));
        
        // And metadata should be parsed correctly
        assert.strictEqual(blocks[0].metadata?.description, 'Count all records');
        assert.strictEqual(blocks[0].metadata?.timeout, 30000); // 30s in milliseconds
        assert.strictEqual(blocks[1].metadata?.description, 'Analyze log levels');
    });

    test('Parse RST configuration blocks', () => {
        const content = `Configuration Test
=================

.. code-block:: config

   @endpoint = 'http://localhost:9200'
   @auth_type = 'basic'
   @username = 'admin'

.. code-block:: sql

   -- Description: Query with config
   SELECT * FROM logs LIMIT 10
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        // Should find only the SQL block (config blocks are handled separately)
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'sql');
        
        assert.ok(blocks[0].content.includes('SELECT * FROM logs'));
        
        // Test configuration blocks separately
        const configBlocks = DocumentParser.parseConfigurationBlocks(document);
        assert.strictEqual(configBlocks.length, 1);
        assert.ok(configBlocks[0].config.endpoint === 'http://localhost:9200');
    });

    test('Ignore non-query RST blocks', () => {
        const content = `Mixed Content
============

.. code-block:: python

   print("This should be ignored")

.. code-block:: sql

   SELECT * FROM test_table

.. code-block:: javascript

   console.log("This should also be ignored");

.. code-block:: ppl

   source=logs | head 5
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        // Should only find SQL and PPL blocks
        assert.strictEqual(blocks.length, 2);
        assert.strictEqual(blocks[0].type, 'sql');
        assert.strictEqual(blocks[1].type, 'ppl');
    });

    test('Handle empty RST blocks', () => {
        const content = `Empty Blocks
===========

.. code-block:: sql

.. code-block:: ppl

   source=logs | head 1
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        // Should find only the non-empty block now that we filter properly
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'ppl');
        assert.ok(blocks[0].content.includes('source=logs'));
    });

    test('Parse RST blocks with proper indentation', () => {
        const content = `Indentation Test
===============

.. code-block:: sql

   SELECT 
     column1,
     column2
   FROM 
     my_table
   WHERE 
     condition = 'value'
`;

        const document = createMockDocument(content);
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'sql');
        
        // Check that indentation is preserved
        const content_lines = blocks[0].content.split('\n');
        assert.ok(content_lines.some(line => line.includes('  column1')));
        assert.ok(content_lines.some(line => line.includes('  column2')));
    });

    test('Fallback to markdown parsing for markdown documents', () => {
        const content = `# Markdown Test

\`\`\`sql
SELECT * FROM test_table
\`\`\`
`;

        const document = createMockDocument(content, 'markdown');
        const blocks = DocumentParser.parseDocument(document);
        
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].type, 'sql');
        assert.ok(blocks[0].content.includes('SELECT * FROM test_table'));
    });
});

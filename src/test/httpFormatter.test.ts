import * as assert from 'assert';
import { HttpFormatter } from '../utils/httpFormatter';
import { QueryResult } from '../types';

suite('HttpFormatter Tests', () => {
    suite('formatRawRequest', () => {
        test('should format basic request info', () => {
            const requestInfo = {
                method: 'POST',
                endpoint: '/_search',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic dGVzdDp0ZXN0'
                },
                body: '{"query":{"match_all":{}}}'
            };

            const result = HttpFormatter.formatRawRequest(requestInfo);

            const expected = `POST /_search HTTP/1.1
Content-Type: application/json
Authorization: Basic dGVzdDp0ZXN0

{"query":{"match_all":{}}}`;

            assert.strictEqual(result, expected);
        });

        test('should format request without body', () => {
            const requestInfo = {
                method: 'GET',
                endpoint: '/_cluster/health',
                headers: {
                    'Accept': 'application/json'
                }
            };

            const result = HttpFormatter.formatRawRequest(requestInfo);

            const expected = `GET /_cluster/health HTTP/1.1
Accept: application/json

`;

            assert.strictEqual(result, expected);
        });

        test('should handle undefined request info', () => {
            const result = HttpFormatter.formatRawRequest(undefined);
            assert.strictEqual(result, 'No request information available');
        });

        test('should handle request with minimal info', () => {
            const requestInfo = {
                method: 'DELETE',
                endpoint: '/test-index'
            };

            const result = HttpFormatter.formatRawRequest(requestInfo);

            const expected = `DELETE /test-index HTTP/1.1

`;

            assert.strictEqual(result, expected);
        });
    });

    suite('formatRawResponse', () => {
        test('should format response with all info', () => {
            const result: QueryResult = {
                success: false,
                error: 'Test error',
                executionTime: 100,
                executedAt: new Date(),
                responseInfo: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: {
                        'content-type': 'application/json',
                        'x-elastic-product': 'OpenSearch'
                    }
                },
                rawResponse: {
                    error: {
                        type: 'parsing_exception',
                        reason: 'Invalid JSON'
                    }
                }
            };

            const formatted = HttpFormatter.formatRawResponse(result);

            const expected = `HTTP/1.1 400 Bad Request
content-type: application/json
x-elastic-product: OpenSearch

{
  "error": {
    "type": "parsing_exception",
    "reason": "Invalid JSON"
  }
}`;

            assert.strictEqual(formatted, expected);
        });

        test('should format response without headers', () => {
            const result: QueryResult = {
                success: false,
                error: 'Test error',
                executionTime: 100,
                executedAt: new Date(),
                responseInfo: {
                    status: 500,
                    statusText: 'Internal Server Error'
                },
                rawResponse: { error: 'Server error' }
            };

            const formatted = HttpFormatter.formatRawResponse(result);

            const expected = `HTTP/1.1 500 Internal Server Error

{
  "error": "Server error"
}`;

            assert.strictEqual(formatted, expected);
        });

        test('should handle result without response info', () => {
            const result: QueryResult = {
                success: false,
                error: 'Network error',
                executionTime: 100,
                executedAt: new Date()
            };

            const formatted = HttpFormatter.formatRawResponse(result);
            assert.strictEqual(formatted, 'No response information available');
        });

        test('should handle result without raw response', () => {
            const result: QueryResult = {
                success: false,
                error: 'Test error',
                executionTime: 100,
                executedAt: new Date(),
                responseInfo: {
                    status: 404,
                    statusText: 'Not Found',
                    headers: { 'content-type': 'application/json' }
                }
            };

            const formatted = HttpFormatter.formatRawResponse(result);

            const expected = `HTTP/1.1 404 Not Found
content-type: application/json

`;

            assert.strictEqual(formatted, expected);
        });
    });

    suite('generateRawRequestSection', () => {
        test('should generate request section with data', () => {
            const result: QueryResult = {
                success: false,
                error: 'Test error',
                executionTime: 100,
                executedAt: new Date(),
                requestInfo: {
                    method: 'POST',
                    endpoint: '/_bulk',
                    headers: { 'Content-Type': 'application/x-ndjson' },
                    body: '{"index":{"_index":"test"}}\n{"field":"value"}\n'
                }
            };

            const section = HttpFormatter.generateRawRequestSection(result);

            assert.ok(section.includes('📤 Raw HTTP Request'));
            assert.ok(section.includes('POST /_bulk HTTP/1.1'));
            assert.ok(section.includes('Content-Type: application/x-ndjson'));
            assert.ok(section.includes('{"index":{"_index":"test"}}'));
        });

        test('should return section when no request info', () => {
            const result: QueryResult = {
                success: false,
                error: 'Test error',
                executionTime: 100,
                executedAt: new Date()
            };

            const section = HttpFormatter.generateRawRequestSection(result);
            assert.ok(section.includes('📤 Raw HTTP Request'));
            assert.ok(section.includes('No request information available'));
        });
    });

    suite('generateRawResponseSection', () => {
        test('should generate response section with data', () => {
            const result: QueryResult = {
                success: false,
                error: 'Test error',
                executionTime: 100,
                executedAt: new Date(),
                responseInfo: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: { 'content-type': 'application/json' }
                },
                rawResponse: { error: { type: 'test_exception', reason: 'test reason' } }
            };

            const section = HttpFormatter.generateRawResponseSection(result);

            assert.ok(section.includes('📥 Raw HTTP Response'));
            assert.ok(section.includes('HTTP/1.1 400 Bad Request'));
            assert.ok(section.includes('content-type: application/json'));
            assert.ok(section.includes('test_exception'));
        });

        test('should return section when no response info', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                data: []
            };

            const section = HttpFormatter.generateRawResponseSection(result);
            assert.ok(section.includes('📥 Raw HTTP Response'));
            assert.ok(section.includes('No response information available'));
        });
    });

    suite('generateCurlCommand', () => {
        test('should generate curl command with all options', () => {
            const requestInfo = {
                method: 'POST',
                endpoint: '/_search',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic dGVzdDp0ZXN0'
                },
                body: '{"query":{"match_all":{}}}'
            };

            const curl = HttpFormatter.generateCurlCommand(requestInfo);

            assert.ok(curl.includes('curl -X POST'));
            assert.ok(curl.includes('-H "Content-Type: application/json"'));
            assert.ok(curl.includes('-H "Authorization: Basic dGVzdDp0ZXN0"'));
            assert.ok(curl.includes('-d \'{"query":{"match_all":{}}}\''));
            assert.ok(curl.includes('"/_search"'));
        });

        test('should generate curl command without body', () => {
            const requestInfo = {
                method: 'GET',
                endpoint: '/_cluster/health',
                headers: {
                    'Accept': 'application/json'
                }
            };

            const curl = HttpFormatter.generateCurlCommand(requestInfo);

            assert.ok(curl.includes('curl -X GET'));
            assert.ok(curl.includes('-H "Accept: application/json"'));
            assert.ok(!curl.includes('-d'));
            assert.ok(curl.includes('"/_cluster/health"'));
        });

        test('should handle undefined request info', () => {
            const curl = HttpFormatter.generateCurlCommand(undefined);
            assert.strictEqual(curl, 'curl command not available - no request information');
        });

        test('should include body in curl command', () => {
            const requestInfo = {
                method: 'POST',
                endpoint: '/_search',
                body: '{"query":{"term":{"field":"value with quotes"}}}'
            };

            const curl = HttpFormatter.generateCurlCommand(requestInfo);

            assert.ok(curl.includes('curl -X POST'));
            assert.ok(curl.includes('-d \'{"query":{"term":{"field":"value with quotes"}}}\''));
            assert.ok(curl.includes('/_search'));
        });
    });

    suite('generateMetadata', () => {
        test('should generate metadata for successful result', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 150,
                executedAt: new Date(),
                rowCount: 25,
                data: []
            };

            const metadata = HttpFormatter.generateMetadata(result);

            assert.ok(metadata.includes('class="metadata"'));
            assert.ok(metadata.includes('✅ Success'));
            assert.ok(metadata.includes('150ms'));
            assert.ok(metadata.includes('25 rows'));
        });

        test('should generate metadata for failed result', () => {
            const result: QueryResult = {
                success: false,
                error: 'Query failed',
                executionTime: 75,
                executedAt: new Date()
            };

            const metadata = HttpFormatter.generateMetadata(result);

            assert.ok(metadata.includes('class="metadata"'));
            assert.ok(metadata.includes('❌ Error'));
            assert.ok(metadata.includes('75ms'));
            assert.ok(!metadata.includes('rows'));
        });

        test('should generate metadata with explain result', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 200,
                executedAt: new Date(),
                data: []
            };

            const explainResult: QueryResult = {
                success: true,
                executionTime: 50,
                executedAt: new Date(),
                data: { plan: 'execution plan' }
            };

            const metadata = HttpFormatter.generateMetadata(result, explainResult);

            assert.ok(metadata.includes('✅ Success'));
            assert.ok(metadata.includes('200ms'));
            assert.ok(metadata.includes('Explain: 50ms'));
        });

        test('should handle failed explain result', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                data: []
            };

            const explainResult: QueryResult = {
                success: false,
                error: 'Explain failed',
                executionTime: 25,
                executedAt: new Date()
            };

            const metadata = HttpFormatter.generateMetadata(result, explainResult);

            assert.ok(metadata.includes('✅ Success'));
            assert.ok(metadata.includes('100ms'));
            assert.ok(metadata.includes('🔍 Explain: Failed'));
        });
    });
});

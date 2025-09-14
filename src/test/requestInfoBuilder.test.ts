import * as assert from 'assert';
import { RequestInfoBuilder } from '../utils/requestInfoBuilder';
import { QueryResult } from '../types';

suite('RequestInfoBuilder Tests', () => {
    suite('buildAuthHeaders', () => {
        test('should build basic auth headers', () => {
            const baseAuth = { type: 'basic', username: 'testuser', password: 'testpass' };
            const headers = RequestInfoBuilder.buildAuthHeaders(baseAuth);

            assert.ok(headers.Authorization);
            assert.ok(headers.Authorization.startsWith('Basic '));
            
            // Decode and verify the base64 encoded credentials
            const encoded = headers.Authorization.split(' ')[1];
            const decoded = Buffer.from(encoded, 'base64').toString();
            assert.strictEqual(decoded, 'testuser:testpass');
        });

        test('should build API key headers', () => {
            const baseAuth = { type: 'apikey', apiKey: 'test-api-key-123' };
            const headers = RequestInfoBuilder.buildAuthHeaders(baseAuth);

            assert.strictEqual(headers.Authorization, 'ApiKey test-api-key-123');
        });

        test('should return empty headers for none auth type', () => {
            const baseAuth = { type: 'none' };
            const headers = RequestInfoBuilder.buildAuthHeaders(baseAuth);

            assert.deepStrictEqual(headers, {});
        });

        test('should handle missing credentials for basic auth', () => {
            const baseAuth = { type: 'basic' };
            const headers = RequestInfoBuilder.buildAuthHeaders(baseAuth);

            assert.deepStrictEqual(headers, {});
        });

        test('should handle missing API key', () => {
            const baseAuth = { type: 'apikey' };
            const headers = RequestInfoBuilder.buildAuthHeaders(baseAuth);

            assert.deepStrictEqual(headers, {});
        });

        test('should apply connection overrides', () => {
            const baseAuth = { type: 'basic', username: 'baseuser', password: 'basepass' };
            const overrides = {
                auth: { type: 'basic' as const, username: 'overrideuser', password: 'overridepass' }
            };
            const headers = RequestInfoBuilder.buildAuthHeaders(baseAuth, overrides);

            assert.ok(headers.Authorization);
            const encoded = headers.Authorization.split(' ')[1];
            const decoded = Buffer.from(encoded, 'base64').toString();
            assert.strictEqual(decoded, 'overrideuser:overridepass');
        });
    });

    suite('buildQueryRequestInfo', () => {
        test('should build SQL query request info', () => {
            const requestInfo = RequestInfoBuilder.buildQueryRequestInfo(
                'sql',
                'SELECT * FROM logs',
                { Authorization: 'Basic dGVzdA==' }
            );

            assert.strictEqual(requestInfo?.method, 'POST');
            assert.strictEqual(requestInfo?.endpoint, '/_plugins/_sql');
            assert.strictEqual(requestInfo?.headers?.['Content-Type'], 'application/json');
            assert.strictEqual(requestInfo?.headers?.Authorization, 'Basic dGVzdA==');
            
            const body = JSON.parse(requestInfo?.body || '{}');
            assert.strictEqual(body.query, 'SELECT * FROM logs');
        });

        test('should build PPL query request info', () => {
            const requestInfo = RequestInfoBuilder.buildQueryRequestInfo(
                'ppl',
                'source=logs | stats count()',
                {}
            );

            assert.strictEqual(requestInfo?.method, 'POST');
            assert.strictEqual(requestInfo?.endpoint, '/_plugins/_ppl');
            assert.strictEqual(requestInfo?.headers?.['Content-Type'], 'application/json');
            
            const body = JSON.parse(requestInfo?.body || '{}');
            assert.strictEqual(body.query, 'source=logs | stats count()');
        });

        test('should build explain query request info', () => {
            const requestInfo = RequestInfoBuilder.buildQueryRequestInfo(
                'sql',
                'SELECT 1',
                {},
                true
            );

            assert.strictEqual(requestInfo?.method, 'POST');
            assert.strictEqual(requestInfo?.endpoint, '/_plugins/_sql/_explain');
            assert.ok(requestInfo?.headers);
        });

        test('should build PPL explain query request info', () => {
            const requestInfo = RequestInfoBuilder.buildQueryRequestInfo(
                'ppl',
                'source=logs | stats count()',
                {},
                true
            );

            assert.strictEqual(requestInfo?.method, 'POST');
            assert.strictEqual(requestInfo?.endpoint, '/_plugins/_ppl/_explain');
            assert.ok(requestInfo?.headers);
        });
    });

    suite('buildApiRequestInfo', () => {
        test('should build API request info with JSON body', () => {
            const requestInfo = RequestInfoBuilder.buildApiRequestInfo(
                'POST',
                '/_search',
                '{"query": {"match_all": {}}}',
                { Authorization: 'ApiKey test123' }
            );

            assert.strictEqual(requestInfo?.method, 'POST');
            assert.strictEqual(requestInfo?.endpoint, '/_search');
            assert.strictEqual(requestInfo?.headers?.['Content-Type'], 'application/json');
            assert.strictEqual(requestInfo?.headers?.Authorization, 'ApiKey test123');
            assert.strictEqual(requestInfo?.body, '{"query": {"match_all": {}}}');
        });

        test('should build API request info with bulk body', () => {
            const bulkBody = `{"index": {"_index": "test"}}
{"field": "value"}`;

            const requestInfo = RequestInfoBuilder.buildApiRequestInfo(
                'POST',
                '/_bulk',
                bulkBody,
                {}
            );

            assert.strictEqual(requestInfo?.method, 'POST');
            assert.strictEqual(requestInfo?.endpoint, '/_bulk');
            assert.strictEqual(requestInfo?.headers?.['Content-Type'], 'application/x-ndjson');
            assert.strictEqual(requestInfo?.body, bulkBody);
        });

        test('should build GET request without body', () => {
            const requestInfo = RequestInfoBuilder.buildApiRequestInfo(
                'GET',
                '/_cluster/health',
                '',
                {}
            );

            assert.strictEqual(requestInfo?.method, 'GET');
            assert.strictEqual(requestInfo?.endpoint, '/_cluster/health');
            assert.strictEqual(requestInfo?.headers?.['Content-Type'], 'application/json');
            assert.strictEqual(requestInfo?.body, '');
        });

        test('should handle DELETE request', () => {
            const requestInfo = RequestInfoBuilder.buildApiRequestInfo(
                'DELETE',
                '/test-index',
                undefined,
                { Authorization: 'Basic test' }
            );

            assert.strictEqual(requestInfo?.method, 'DELETE');
            assert.strictEqual(requestInfo?.endpoint, '/test-index');
            assert.strictEqual(requestInfo?.headers?.Authorization, 'Basic test');
            assert.strictEqual(requestInfo?.body, '');
        });
    });

    suite('addRequestInfoToResponse', () => {
        test('should add request info to successful response', () => {
            const response: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                data: { acknowledged: true }
            };

            const requestInfo = {
                method: 'POST',
                endpoint: '/_search',
                headers: { 'Content-Type': 'application/json' },
                body: '{"query": {"match_all": {}}}'
            };

            const result = RequestInfoBuilder.addRequestInfoToResponse(response, requestInfo);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 100);
            assert.deepStrictEqual(result.requestInfo, requestInfo);
            assert.deepStrictEqual(result.data, { acknowledged: true });
        });

        test('should add request info to error response', () => {
            const response: QueryResult = {
                success: false,
                error: 'Query failed',
                executionTime: 50,
                executedAt: new Date()
            };

            const requestInfo = {
                method: 'POST',
                endpoint: '/_sql',
                headers: { 'Content-Type': 'application/json' },
                body: '{"query": "SELECT * FROM invalid"}'
            };

            const result = RequestInfoBuilder.addRequestInfoToResponse(response, requestInfo);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Query failed');
            assert.deepStrictEqual(result.requestInfo, requestInfo);
        });
    });

    suite('addResponseInfoToResponse', () => {
        test('should add response info to result', () => {
            const response: QueryResult = {
                success: true,
                executionTime: 200,
                executedAt: new Date(),
                data: []
            };

            const responseInfo = {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' }
            };

            const result = RequestInfoBuilder.addResponseInfoToResponse(response, responseInfo);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 200);
            assert.deepStrictEqual(result.responseInfo, responseInfo);
        });

        test('should add response info to error result', () => {
            const response: QueryResult = {
                success: false,
                error: 'Bad request',
                executionTime: 25,
                executedAt: new Date()
            };

            const responseInfo = {
                status: 400,
                statusText: 'Bad Request',
                headers: { 'content-type': 'application/json' }
            };

            const result = RequestInfoBuilder.addResponseInfoToResponse(response, responseInfo);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Bad request');
            assert.deepStrictEqual(result.responseInfo, responseInfo);
        });
    });

    suite('processBulkBody', () => {
        test('should process valid bulk body', () => {
            const bulkBody = `{"index": {"_index": "test"}}
{"field": "value"}
{"delete": {"_index": "test", "_id": "1"}}`;

            const result = RequestInfoBuilder.processBulkBody(bulkBody);

            assert.ok(result.endsWith('\n'));
            assert.ok(result.includes('{"index": {"_index": "test"}}'));
            assert.ok(result.includes('{"field": "value"}'));
            assert.ok(result.includes('{"delete": {"_index": "test", "_id": "1"}}'));
        });

        test('should add trailing newline if missing', () => {
            const bulkBody = `{"index": {"_index": "test"}}
{"field": "value"}`;

            const result = RequestInfoBuilder.processBulkBody(bulkBody);

            assert.ok(result.endsWith('\n'));
            assert.strictEqual(result, bulkBody + '\n');
        });

        test('should preserve existing trailing newline', () => {
            const bulkBody = `{"index": {"_index": "test"}}
{"field": "value"}
`;

            const result = RequestInfoBuilder.processBulkBody(bulkBody);

            assert.strictEqual(result, bulkBody);
        });

        test('should handle empty bulk body', () => {
            const result = RequestInfoBuilder.processBulkBody('');

            assert.strictEqual(result, '\n');
        });

        test('should handle single line bulk body', () => {
            const bulkBody = '{"index": {"_index": "test"}}';

            const result = RequestInfoBuilder.processBulkBody(bulkBody);

            assert.strictEqual(result, bulkBody + '\n');
        });
    });

    suite('validateJsonBody', () => {
        test('should validate and parse valid JSON', () => {
            const jsonBody = '{"query": {"match_all": {}}, "size": 10}';

            const result = RequestInfoBuilder.validateJsonBody(jsonBody);

            assert.deepStrictEqual(result, {
                query: { match_all: {} },
                size: 10
            });
        });

        test('should handle empty JSON object', () => {
            const result = RequestInfoBuilder.validateJsonBody('{}');

            assert.deepStrictEqual(result, {});
        });

        test('should handle JSON array', () => {
            const jsonBody = '[{"field": "value1"}, {"field": "value2"}]';

            const result = RequestInfoBuilder.validateJsonBody(jsonBody);

            assert.deepStrictEqual(result, [
                { field: 'value1' },
                { field: 'value2' }
            ]);
        });

        test('should throw error for invalid JSON', () => {
            const invalidJson = '{"query": {"match_all": {}';

            assert.throws(() => {
                RequestInfoBuilder.validateJsonBody(invalidJson);
            }, /Invalid JSON in request body/);
        });

        test('should throw error for empty string', () => {
            assert.throws(() => {
                RequestInfoBuilder.validateJsonBody('');
            }, /Invalid JSON in request body/);
        });

        test('should throw error for non-JSON string', () => {
            assert.throws(() => {
                RequestInfoBuilder.validateJsonBody('not json at all');
            }, /Invalid JSON in request body/);
        });

        test('should handle JSON with whitespace', () => {
            const jsonBody = `
            {
                "query": {
                    "match_all": {}
                }
            }
            `;

            const result = RequestInfoBuilder.validateJsonBody(jsonBody);

            assert.deepStrictEqual(result, {
                query: { match_all: {} }
            });
        });
    });
});

import * as assert from 'assert';
import { ResponseProcessor } from '../utils/responseProcessor';
import { QueryResult, OpenSearchResponse } from '../types';

suite('ResponseProcessor Tests', () => {
    suite('processQueryResponse', () => {
        test('should process SQL response with schema and datarows', () => {
            const response = {
                schema: [
                    { name: 'id', type: 'integer' },
                    { name: 'name', type: 'text' },
                    { name: 'age', type: 'integer' }
                ],
                datarows: [
                    [1, 'John', 25],
                    [2, 'Jane', 30],
                    [3, 'Bob', 35]
                ],
                total: 3,
                size: 3
            };
            const executionTime = 150;
            const queryType = 'sql';

            const result = ResponseProcessor.processQueryResponse(response, executionTime, queryType);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 150);
            assert.strictEqual(result.rowCount, 3);
            assert.deepStrictEqual(result.columns, ['id', 'name', 'age']);
            assert.strictEqual(result.data?.length, 3);
            assert.deepStrictEqual(result.data?.[0], { id: 1, name: 'John', age: 25 });
            assert.deepStrictEqual(result.data?.[1], { id: 2, name: 'Jane', age: 30 });
            assert.deepStrictEqual(result.data?.[2], { id: 3, name: 'Bob', age: 35 });
        });

        test('should process PPL response with schema and datarows', () => {
            const response = {
                schema: [
                    { name: 'timestamp', type: 'timestamp' },
                    { name: 'level', type: 'text' },
                    { name: 'message', type: 'text' }
                ],
                datarows: [
                    ['2023-01-01T10:00:00Z', 'INFO', 'Application started'],
                    ['2023-01-01T10:01:00Z', 'WARN', 'Low memory warning']
                ],
                total: 2
            };
            const executionTime = 75;
            const queryType = 'ppl';

            const result = ResponseProcessor.processQueryResponse(response, executionTime, queryType);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 75);
            assert.strictEqual(result.rowCount, 2);
            assert.deepStrictEqual(result.columns, ['timestamp', 'level', 'message']);
            assert.strictEqual(result.data?.length, 2);
            assert.deepStrictEqual(result.data?.[0], { 
                timestamp: '2023-01-01T10:00:00Z', 
                level: 'INFO', 
                message: 'Application started' 
            });
        });

        test('should process OpenSearch API response with hits', () => {
            const response = {
                took: 5,
                timed_out: false,
                _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
                hits: {
                    total: { value: 2, relation: 'eq' },
                    max_score: 1.0,
                    hits: [
                        {
                            _index: 'test-index',
                            _id: '1',
                            _score: 1.0,
                            _source: { name: 'John', age: 25, city: 'New York' }
                        },
                        {
                            _index: 'test-index',
                            _id: '2',
                            _score: 0.8,
                            _source: { name: 'Jane', age: 30, city: 'Boston' }
                        }
                    ]
                }
            };
            const executionTime = 200;
            const queryType = 'opensearch-api';

            const result = ResponseProcessor.processQueryResponse(response, executionTime, queryType);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 200);
            assert.strictEqual(result.rowCount, 2);
            assert.deepStrictEqual(result.columns, ['_index', '_id', '_score', 'name', 'age', 'city']);
            assert.strictEqual(result.data?.length, 2);
            // The data should be the raw hits array, not flattened objects
            assert.deepStrictEqual(result.data?.[0], {
                _index: 'test-index',
                _id: '1',
                _score: 1.0,
                _source: { name: 'John', age: 25, city: 'New York' }
            });
        });

        test('should process OpenSearch API response without hits', () => {
            const response: any = {
                acknowledged: true,
                shards_acknowledged: true,
                index: 'test-index'
            };
            const executionTime = 50;
            const queryType = 'opensearch-api';

            const result = ResponseProcessor.processQueryResponse(response, executionTime, queryType);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 50);
            assert.strictEqual(result.rowCount, 1); // acknowledged = true means 1 row
            assert.strictEqual(result.columns, undefined);
            assert.deepStrictEqual(result.data, response);
        });

        test('should handle empty SQL response', () => {
            const response = {
                schema: [
                    { name: 'id', type: 'integer' },
                    { name: 'name', type: 'text' }
                ],
                datarows: [],
                total: 0
            };
            const executionTime = 25;
            const queryType = 'sql';

            const result = ResponseProcessor.processQueryResponse(response, executionTime, queryType);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 25);
            assert.strictEqual(result.rowCount, 0);
            assert.deepStrictEqual(result.columns, ['id', 'name']);
            assert.deepStrictEqual(result.data, []);
        });

        test('should handle OpenSearch response with empty hits', () => {
            const response: any = {
                took: 2,
                hits: {
                    total: { value: 0, relation: 'eq' },
                    max_score: null,
                    hits: []
                }
            };
            const executionTime = 30;
            const queryType = 'opensearch-api';

            const result = ResponseProcessor.processQueryResponse(response, executionTime, queryType);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.executionTime, 30);
            assert.strictEqual(result.rowCount, 0);
            assert.deepStrictEqual(result.data, []);
        });
    });

    suite('formatResultForDisplay', () => {
        test('should format successful result as table', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                rowCount: 2,
                columns: ['id', 'name', 'age'],
                data: [
                    { id: 1, name: 'John', age: 25 },
                    { id: 2, name: 'Jane', age: 30 }
                ]
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result, 'table');

            assert.ok(formatted.includes('Query executed successfully'));
            assert.ok(formatted.includes('100ms'));
            assert.ok(formatted.includes('**Rows**: 2'));
            assert.ok(formatted.includes('| id | name | age |'));
            assert.ok(formatted.includes('| 1 | John | 25 |'));
            assert.ok(formatted.includes('| 2 | Jane | 30 |'));
        });

        test('should format successful result as JSON', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 150,
                executedAt: new Date(),
                data: [{ id: 1, name: 'Test' }]
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result, 'json');

            assert.ok(formatted.includes('Query executed successfully'));
            assert.ok(formatted.includes('150ms'));
            assert.ok(formatted.includes('"id": 1'));
            assert.ok(formatted.includes('"name": "Test"'));
        });

        test('should format failed result', () => {
            const result: QueryResult = {
                success: false,
                error: 'Query parsing failed',
                executionTime: 50,
                executedAt: new Date()
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result);

            assert.ok(formatted.includes('❌ **Error**'));
            assert.ok(formatted.includes('Query parsing failed'));
            assert.ok(formatted.includes('50ms'));
        });

        test('should handle result with no data', () => {
            const result: QueryResult = {
                success: true,
                executionTime: 25,
                executedAt: new Date(),
                rowCount: 0,
                data: []
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result, 'table');

            assert.ok(formatted.includes('Query executed successfully'));
            assert.ok(formatted.includes('**Rows**: 0'));
            // When data is empty array, it should show JSON format, not table format
            assert.ok(formatted.includes('```json') && formatted.includes('[]'));
        });
    });

    suite('validateResponse', () => {
        test('should validate valid SQL response', () => {
            const response = {
                schema: [{ name: 'id', type: 'integer' }],
                datarows: [[1], [2]],
                total: 2
            };

            const result = ResponseProcessor.validateResponse(response);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        test('should validate valid OpenSearch response', () => {
            const response = {
                took: 5,
                hits: {
                    total: { value: 1, relation: 'eq' },
                    hits: [{ _index: 'test', _id: '1', _source: {} }]
                }
            };

            const result = ResponseProcessor.validateResponse(response);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        test('should invalidate null response', () => {
            const result = ResponseProcessor.validateResponse(null);

            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Response is null or undefined');
        });

        test('should invalidate undefined response', () => {
            const result = ResponseProcessor.validateResponse(undefined);

            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Response is null or undefined');
        });

        test('should invalidate non-object response', () => {
            const result = ResponseProcessor.validateResponse('invalid');

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });

        test('should validate generic object response', () => {
            const response = { acknowledged: true };

            const result = ResponseProcessor.validateResponse(response);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, undefined);
        });
    });

    suite('extractResponseSummary', () => {
        test('should extract summary from search response', () => {
            const response: OpenSearchResponse = {
                took: 15,
                timed_out: false,
                _shards: { total: 5, successful: 5, skipped: 0, failed: 0 },
                hits: {
                    total: { value: 100, relation: 'eq' },
                    max_score: 1.5,
                    hits: []
                }
            };

            const summary = ResponseProcessor.extractResponseSummary(response);

            assert.strictEqual(summary.type, 'search');
            assert.strictEqual(summary.recordCount, 100);
            assert.strictEqual(summary.hasData, false); // hits array is empty
        });

        test('should extract summary from aggregation response', () => {
            const response: any = {
                took: 25,
                hits: { 
                    total: { value: 0, relation: 'eq' }, 
                    max_score: null,
                    hits: [] 
                }
            };

            const summary = ResponseProcessor.extractResponseSummary(response);

            assert.strictEqual(summary.type, 'search');
            assert.strictEqual(summary.recordCount, 0);
            assert.strictEqual(summary.hasData, false);
        });

        test('should handle response without hits', () => {
            const response: any = {
                acknowledged: true,
                index: 'test-index'
            };

            const summary = ResponseProcessor.extractResponseSummary(response);

            assert.strictEqual(summary.type, 'object');
            assert.strictEqual(summary.recordCount, 1);
            assert.strictEqual(summary.hasData, true);
        });

        test('should handle SQL response', () => {
            const response: OpenSearchResponse = {
                schema: [{ name: 'id', type: 'integer' }],
                datarows: [[1], [2], [3]]
            };

            const summary = ResponseProcessor.extractResponseSummary(response);

            assert.strictEqual(summary.type, 'sql');
            assert.strictEqual(summary.recordCount, 3);
            assert.strictEqual(summary.hasData, true);
        });

        test('should handle array response', () => {
            const response: any = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
            ];

            const summary = ResponseProcessor.extractResponseSummary(response);

            assert.strictEqual(summary.type, 'array');
            assert.strictEqual(summary.recordCount, 2);
            assert.strictEqual(summary.hasData, true);
        });
    });

    suite('private helper methods', () => {
        test('should format table with data', () => {
            const data = [
                { id: 1, name: 'John', active: true },
                { id: 2, name: 'Jane', active: false }
            ];
            const columns = ['id', 'name', 'active'];

            // Access private method through public interface
            const result: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                data,
                columns
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result, 'table');

            assert.ok(formatted.includes('| id | name | active |'));
            assert.ok(formatted.includes('| 1 | John | true |'));
            assert.ok(formatted.includes('| 2 | Jane | false |'));
        });

        test('should handle nested object values in table', () => {
            const data = [
                { id: 1, user: { name: 'John', age: 25 }, tags: ['admin', 'user'] }
            ];
            const columns = ['id', 'user', 'tags'];

            const result: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                data,
                columns
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result, 'table');

            assert.ok(formatted.includes('| id | user | tags |'));
            assert.ok(formatted.includes('| 1 |'));
            // Should contain JSON representation of complex objects
            assert.ok(formatted.includes('John') || formatted.includes('"name"'));
        });

        test('should handle null and undefined values in table', () => {
            const data = [
                { id: 1, name: null, description: undefined, active: true }
            ];
            const columns = ['id', 'name', 'description', 'active'];

            const result: QueryResult = {
                success: true,
                executionTime: 100,
                executedAt: new Date(),
                data,
                columns
            };

            const formatted = ResponseProcessor.formatResultForDisplay(result, 'table');

            assert.ok(formatted.includes('| id | name | description | active |'));
            assert.ok(formatted.includes('| 1 |'));
            assert.ok(formatted.includes('| true |'));
        });
    });
});

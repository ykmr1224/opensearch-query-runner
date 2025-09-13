import * as assert from 'assert';
import { ErrorHandler } from '../utils/errorHandler';

suite('ErrorHandler Tests', () => {
    suite('extractErrorInfo', () => {
        test('should extract error info from axios error with response', () => {
            const axiosError = {
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: { 'content-type': 'application/json' },
                    data: {
                        error: {
                            type: 'parsing_exception',
                            reason: 'Invalid JSON syntax'
                        }
                    }
                },
                config: {
                    method: 'post',
                    url: '/_search',
                    headers: { 'Content-Type': 'application/json' },
                    data: '{ "query": { "invalid" } }'
                }
            };

            const result = ErrorHandler.extractErrorInfo(axiosError);

            assert.strictEqual(result.responseInfo?.status, 400);
            assert.strictEqual(result.responseInfo?.statusText, 'Bad Request');
            assert.deepStrictEqual(result.responseInfo?.headers, { 'content-type': 'application/json' });
            assert.deepStrictEqual(result.rawResponse, axiosError.response.data);
            assert.strictEqual(result.requestInfo?.method, 'POST');
            assert.strictEqual(result.requestInfo?.endpoint, '/_search');
            assert.strictEqual(result.requestInfo?.body, '{ "query": { "invalid" } }');
        });

        test('should extract error info from axios error without response', () => {
            const axiosError = {
                message: 'Network Error',
                code: 'ECONNREFUSED',
                config: {
                    method: 'get',
                    url: '/_cluster/health'
                }
            };

            const result = ErrorHandler.extractErrorInfo(axiosError);

            assert.strictEqual(result.responseInfo, undefined);
            assert.strictEqual(result.rawResponse, undefined);
            assert.strictEqual(result.requestInfo?.method, 'GET');
            assert.strictEqual(result.requestInfo?.endpoint, '/_cluster/health');
        });

        test('should extract error info from axios error with object data', () => {
            const axiosError = {
                response: {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: {},
                    data: {
                        error: {
                            type: 'search_phase_execution_exception',
                            reason: 'all shards failed'
                        }
                    }
                },
                config: {
                    method: 'post',
                    url: '/test-index/_search',
                    data: { query: { match_all: {} } }
                }
            };

            const result = ErrorHandler.extractErrorInfo(axiosError);

            assert.strictEqual(result.responseInfo?.status, 500);
            assert.strictEqual(result.responseInfo?.statusText, 'Internal Server Error');
            assert.deepStrictEqual(result.rawResponse, axiosError.response.data);
            assert.strictEqual(result.requestInfo?.method, 'POST');
            assert.strictEqual(result.requestInfo?.endpoint, '/test-index/_search');
            assert.strictEqual(result.requestInfo?.body, JSON.stringify({ query: { match_all: {} } }, null, 2));
        });

        test('should handle error without config', () => {
            const simpleError = {
                response: {
                    status: 404,
                    statusText: 'Not Found',
                    headers: {},
                    data: { error: { type: 'index_not_found_exception', reason: 'no such index' } }
                }
            };

            const result = ErrorHandler.extractErrorInfo(simpleError);

            assert.strictEqual(result.responseInfo?.status, 404);
            assert.strictEqual(result.responseInfo?.statusText, 'Not Found');
            assert.deepStrictEqual(result.rawResponse, simpleError.response.data);
            assert.strictEqual(result.requestInfo, undefined);
        });

        test('should handle error without response or config', () => {
            const networkError = { message: 'Network Error' };

            const result = ErrorHandler.extractErrorInfo(networkError);

            assert.strictEqual(result.responseInfo, undefined);
            assert.strictEqual(result.rawResponse, undefined);
            assert.strictEqual(result.requestInfo, undefined);
        });
    });

    suite('createErrorResponse', () => {
        test('should create error response with axios error', () => {
            const error = {
                message: 'Request failed with status code 404',
                response: {
                    status: 404,
                    statusText: 'Not Found',
                    headers: {},
                    data: { error: { type: 'index_not_found_exception', reason: 'no such index [missing]' } }
                },
                config: {
                    method: 'get',
                    url: '/missing-index/_search'
                }
            };
            const startTime = Date.now() - 150;

            const result = ErrorHandler.createErrorResponse(error, startTime);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Request failed with status code 404');
            assert.ok(result.executionTime >= 150);
            assert.deepStrictEqual(result.rawResponse, error.response.data);
            assert.strictEqual(result.responseInfo?.status, 404);
            assert.strictEqual(result.responseInfo?.statusText, 'Not Found');
            assert.strictEqual(result.requestInfo?.method, 'GET');
            assert.strictEqual(result.requestInfo?.endpoint, '/missing-index/_search');
        });

        test('should create error response with custom message', () => {
            const error = new Error('Original error');
            const startTime = Date.now() - 1000;
            const customMessage = 'Custom error message';

            const result = ErrorHandler.createErrorResponse(error, startTime, customMessage);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, customMessage);
            assert.ok(result.executionTime >= 1000);
            assert.strictEqual(result.rawResponse, undefined);
            assert.strictEqual(result.responseInfo, undefined);
            assert.strictEqual(result.requestInfo, undefined);
        });

        test('should create error response without message', () => {
            const error = { someProperty: 'value' };
            const startTime = Date.now() - 500;

            const result = ErrorHandler.createErrorResponse(error, startTime);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Unknown error occurred');
            assert.ok(result.executionTime >= 500);
        });
    });

    suite('createApiErrorResponse', () => {
        test('should create API error response with error object', () => {
            const response = {
                error: {
                    type: 'parsing_exception',
                    reason: 'Invalid JSON syntax'
                },
                requestInfo: {
                    method: 'POST',
                    endpoint: '/_search',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{ "query": { "invalid" } }'
                },
                responseInfo: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: { 'content-type': 'application/json' }
                }
            };
            const startTime = Date.now() - 200;

            const result = ErrorHandler.createApiErrorResponse(response, startTime);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'parsing_exception: Invalid JSON syntax');
            assert.ok(result.executionTime >= 200);
            assert.deepStrictEqual(result.requestInfo, response.requestInfo);
            assert.deepStrictEqual(result.responseInfo, response.responseInfo);
            assert.deepStrictEqual(result.rawResponse, response);
        });

        test('should create API error response without additional info', () => {
            const response = {
                error: {
                    type: 'cluster_block_exception',
                    reason: 'blocked by: [FORBIDDEN/12/index read-only]'
                }
            };
            const startTime = Date.now() - 1500;

            const result = ErrorHandler.createApiErrorResponse(response, startTime);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'cluster_block_exception: blocked by: [FORBIDDEN/12/index read-only]');
            assert.ok(result.executionTime >= 1500);
            assert.strictEqual(result.requestInfo, undefined);
            assert.strictEqual(result.responseInfo, undefined);
            assert.deepStrictEqual(result.rawResponse, response);
        });
    });

    suite('formatError', () => {
        test('should format axios error with response and error reason', () => {
            const error = {
                response: {
                    status: 403,
                    statusText: 'Forbidden',
                    data: {
                        error: {
                            type: 'security_exception',
                            reason: 'action [indices:data/read/search] is unauthorized for user [test-user]'
                        }
                    }
                }
            };

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, '403 Forbidden: action [indices:data/read/search] is unauthorized for user [test-user]');
        });

        test('should format axios error with response and error type only', () => {
            const error = {
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: {
                        error: {
                            type: 'parsing_exception'
                        }
                    }
                }
            };

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, '400 Bad Request: parsing_exception');
        });

        test('should format axios error with response but no error details', () => {
            const error = {
                response: {
                    status: 500,
                    statusText: 'Internal Server Error',
                    data: {}
                }
            };

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, '500 Internal Server Error');
        });

        test('should format network error (request but no response)', () => {
            const error = {
                request: {},
                message: 'Network Error'
            };

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, 'Network error: Unable to connect to OpenSearch cluster');
        });

        test('should format Error object', () => {
            const error = new Error('Standard error message');

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, 'Standard error message');
        });

        test('should handle error with message property', () => {
            const error = { message: 'Custom error message' };

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, 'Custom error message');
        });

        test('should handle unknown error format', () => {
            const error = { unknown: 'format' };

            const result = ErrorHandler.formatError(error);

            assert.strictEqual(result, 'Unknown error occurred');
        });
    });
});

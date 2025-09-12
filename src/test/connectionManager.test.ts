import * as assert from 'assert';
import * as sinon from 'sinon';
import axios from 'axios';

// Mock vscode module before importing ConnectionManager
const mockVscode = {
    workspace: {
        getConfiguration: (section?: string) => ({
            get: (key: string, defaultValue?: any) => {
                const config: any = {
                    'endpoint': 'http://localhost:9200',
                    'auth.type': 'none',
                    'auth.username': '',
                    'auth.password': '',
                    'auth.apiKey': '',
                    'timeout': 30000,
                    'maxHistoryItems': 100,
                    'enableCodeLens': true
                };
                return config[key] || defaultValue;
            }
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} })
    },
    ConfigurationTarget: {
        Workspace: 2
    },
    window: {
        showInputBox: () => Promise.resolve(''),
        showQuickPick: () => Promise.resolve(null),
        showInformationMessage: () => Promise.resolve(''),
        showWarningMessage: () => Promise.resolve('')
    }
};

// Mock the vscode module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

import { ConnectionManager } from '../connectionManager';

suite('ConnectionManager Tests', () => {
    let connectionManager: ConnectionManager;
    let axiosStub: sinon.SinonStub;

    setup(() => {
        // Reset axios stub before each test
        if (axiosStub) {
            axiosStub.restore();
        }
        
        // Create a mock axios instance that will be returned by axios.create
        const mockAxiosInstance = {
            request: sinon.stub(),
            get: sinon.stub(),
            post: sinon.stub()
        };
        
        axiosStub = sinon.stub(axios, 'create').returns(mockAxiosInstance as any);
        connectionManager = new ConnectionManager();
    });

    teardown(() => {
        sinon.restore();
    });

    suite('Bulk Request Handling', () => {
        test('should detect bulk operations correctly', async () => {
            // Get the mock axios instance that was created in setup
            const mockAxiosInstance = axiosStub.returnValues[0];
            
            // Configure the mock to return a successful response
            mockAxiosInstance.request.resolves({
                data: { items: [] },
                status: 200,
                statusText: 'OK',
                headers: {}
            });

            const bulkBody = `{ "index": { "_index": "test" } }
{ "field": "value" }`;

            await connectionManager.executeApiOperation('POST', '/_bulk', bulkBody);

            // Verify the request was made with correct configuration
            assert.strictEqual(mockAxiosInstance.request.calledOnce, true);
            
            const requestConfig = mockAxiosInstance.request.getCall(0).args[0];
            
            // Should use NDJSON content type for bulk operations
            assert.strictEqual(requestConfig.headers['Content-Type'], 'application/x-ndjson');
            
            // Should have transformRequest to prevent axios from modifying the data
            assert.ok(requestConfig.transformRequest);
            assert.strictEqual(Array.isArray(requestConfig.transformRequest), true);
            
            // Should preserve the raw string data with trailing newline
            assert.strictEqual(requestConfig.data, bulkBody + '\n');
        });

        test('should validate JSON in bulk request lines', async () => {
            const invalidBulkBody = `{ "index": { "_index": "test" } }
{ invalid json }`;

            try {
                await connectionManager.executeApiOperation('POST', '/_bulk', invalidBulkBody);
                assert.fail('Should have thrown an error for invalid JSON');
            } catch (error: any) {
                assert.ok(error.message.includes('Invalid JSON in bulk request line'));
            }
        });

        test('should handle bulk requests with empty lines', async () => {
            const mockAxiosInstance = axiosStub.returnValues[0];
            mockAxiosInstance.request.resolves({
                data: { items: [] },
                status: 200,
                statusText: 'OK',
                headers: {}
            });

            const bulkBodyWithEmptyLines = `{ "index": { "_index": "test" } }
{ "field": "value" }

{ "index": { "_index": "test2" } }
{ "field2": "value2" }`;

            await connectionManager.executeApiOperation('POST', '/_bulk', bulkBodyWithEmptyLines);

            const requestConfig = mockAxiosInstance.request.getCall(0).args[0];
            
            // Should still work with empty lines
            assert.strictEqual(requestConfig.headers['Content-Type'], 'application/x-ndjson');
            assert.ok(requestConfig.data.endsWith('\n'));
        });

        test('should use regular JSON for non-bulk operations', async () => {
            const mockAxiosInstance = axiosStub.returnValues[0];
            mockAxiosInstance.request.resolves({
                data: { acknowledged: true },
                status: 200,
                statusText: 'OK',
                headers: {}
            });

            const regularBody = `{ "mappings": { "properties": { "field": { "type": "text" } } } }`;

            await connectionManager.executeApiOperation('PUT', '/test-index', regularBody);

            const requestConfig = mockAxiosInstance.request.getCall(0).args[0];
            
            // Should use regular JSON content type
            assert.strictEqual(requestConfig.headers['Content-Type'], 'application/json');
            
            // Should not have transformRequest for regular operations
            assert.strictEqual(requestConfig.transformRequest, undefined);
            
            // Should parse the JSON body
            assert.strictEqual(typeof requestConfig.data, 'object');
        });

        test('should include request info in error responses', async () => {
            const mockAxiosInstance = axiosStub.returnValues[0];
            mockAxiosInstance.request.rejects({
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    headers: {},
                    data: { error: { type: 'parsing_exception', reason: 'Invalid JSON' } }
                }
            });

            const bulkBody = `{ "index": { "_index": "test" } }
{ "field": "value" }`;

            const result = await connectionManager.executeApiOperation('POST', '/_bulk', bulkBody);

            // Should have error info
            assert.ok(result.error);
            assert.strictEqual(result.error.type, 'parsing_exception');
            
            // Should have request info even in error case
            assert.ok(result.requestInfo);
            assert.strictEqual(result.requestInfo.method, 'POST');
            assert.strictEqual(result.requestInfo.endpoint, '/_bulk');
            assert.strictEqual(result.requestInfo.headers['Content-Type'], 'application/x-ndjson');
            assert.strictEqual(result.requestInfo.body, bulkBody);
            
            // Should have response info
            assert.ok(result.responseInfo);
            assert.strictEqual(result.responseInfo.status, 400);
        });

        test('should include request info in successful responses', async () => {
            const mockAxiosInstance = axiosStub.returnValues[0];
            mockAxiosInstance.request.resolves({
                data: { 
                    items: [
                        { index: { _index: 'test', _id: '1', status: 201 } }
                    ]
                },
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' }
            });

            const bulkBody = `{ "index": { "_index": "test" } }
{ "field": "value" }`;

            const result = await connectionManager.executeApiOperation('POST', '/_bulk', bulkBody);

            // Should be successful
            assert.strictEqual(result.error, undefined);
            
            // Should have request info
            assert.ok(result.requestInfo);
            assert.strictEqual(result.requestInfo.method, 'POST');
            assert.strictEqual(result.requestInfo.endpoint, '/_bulk');
            assert.strictEqual(result.requestInfo.headers['Content-Type'], 'application/x-ndjson');
            assert.strictEqual(result.requestInfo.body, bulkBody);
            
            // Should have response info
            assert.ok(result.responseInfo);
            assert.strictEqual(result.responseInfo.status, 200);
        });

        test('should ensure bulk body ends with newline', async () => {
            const mockAxiosInstance = axiosStub.returnValues[0];
            mockAxiosInstance.request.resolves({
                data: { items: [] },
                status: 200,
                statusText: 'OK',
                headers: {}
            });

            // Body without trailing newline
            const bulkBodyWithoutNewline = `{ "index": { "_index": "test" } }
{ "field": "value" }`;

            await connectionManager.executeApiOperation('POST', '/_bulk', bulkBodyWithoutNewline);

            const requestConfig = mockAxiosInstance.request.getCall(0).args[0];
            
            // Should add trailing newline
            assert.ok(requestConfig.data.endsWith('\n'));
            assert.strictEqual(requestConfig.data, bulkBodyWithoutNewline + '\n');
        });

        test('should preserve existing trailing newline', async () => {
            const mockAxiosInstance = axiosStub.returnValues[0];
            mockAxiosInstance.request.resolves({
                data: { items: [] },
                status: 200,
                statusText: 'OK',
                headers: {}
            });

            // Body with existing trailing newline
            const bulkBodyWithNewline = `{ "index": { "_index": "test" } }
{ "field": "value" }
`;

            await connectionManager.executeApiOperation('POST', '/_bulk', bulkBodyWithNewline);

            const requestConfig = mockAxiosInstance.request.getCall(0).args[0];
            
            // Should not add extra newline
            assert.strictEqual(requestConfig.data, bulkBodyWithNewline);
        });
    });
});

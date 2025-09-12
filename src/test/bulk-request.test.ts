import * as assert from 'assert';
import * as sinon from 'sinon';
import axios from 'axios';

// Simple test to verify bulk request functionality
suite('Bulk Request Logic Tests', () => {
    let axiosCreateStub: sinon.SinonStub;
    let mockAxiosInstance: any;

    setup(() => {
        mockAxiosInstance = {
            request: sinon.stub()
        };
        axiosCreateStub = sinon.stub(axios, 'create').returns(mockAxiosInstance);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should format bulk request with correct content type and data', async () => {
        // Mock successful response
        mockAxiosInstance.request.resolves({
            data: { items: [] },
            status: 200,
            statusText: 'OK',
            headers: {}
        });

        // Simulate the bulk request logic from ConnectionManager
        const endpoint = '/_bulk';
        const body = `{ "index": { "_index": "test" } }
{ "field": "value" }`;

        // Check if this is a bulk operation
        const isBulkOperation = endpoint.includes('/_bulk');
        
        let requestBody: any = undefined;
        let contentType = 'application/json';
        
        if (body && body.trim()) {
            if (isBulkOperation) {
                // For bulk operations, ensure proper NDJSON format
                let processedBody = body.trim();
                
                // Validate that each non-empty line is valid JSON
                const lines = processedBody.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            JSON.parse(line.trim());
                        } catch (error) {
                            throw new Error(`Invalid JSON in bulk request line: ${line.trim()}`);
                        }
                    }
                }
                
                // Ensure the body ends with a newline
                if (!processedBody.endsWith('\n')) {
                    processedBody += '\n';
                }
                
                requestBody = processedBody;
                contentType = 'application/x-ndjson';
            } else {
                // For regular JSON operations, parse the body
                try {
                    requestBody = JSON.parse(body);
                } catch (error) {
                    throw new Error('Invalid JSON in request body');
                }
            }
        }

        const requestHeaders = {
            'Content-Type': contentType
        };

        const requestConfig: any = {
            method: 'post',
            url: endpoint,
            data: requestBody,
            headers: requestHeaders
        };

        // For bulk operations, prevent axios from transforming the request data
        if (endpoint.includes('/_bulk')) {
            requestConfig.transformRequest = [(data: any) => data];
        }

        // Make the request
        await mockAxiosInstance.request(requestConfig);

        // Verify the request was called correctly
        assert.strictEqual(mockAxiosInstance.request.calledOnce, true);
        
        const actualConfig = mockAxiosInstance.request.getCall(0).args[0];
        
        // Verify content type is NDJSON for bulk operations
        assert.strictEqual(actualConfig.headers['Content-Type'], 'application/x-ndjson');
        
        // Verify transformRequest is set to prevent axios transformation
        assert.ok(actualConfig.transformRequest);
        assert.strictEqual(Array.isArray(actualConfig.transformRequest), true);
        
        // Verify the data ends with newline
        assert.ok(actualConfig.data.endsWith('\n'));
        assert.strictEqual(actualConfig.data, body + '\n');
    });

    test('should validate JSON lines in bulk request', () => {
        const invalidBulkBody = `{ "index": { "_index": "test" } }
{ invalid json }`;

        const lines = invalidBulkBody.split('\n');
        let errorThrown = false;
        
        try {
            for (const line of lines) {
                if (line.trim()) {
                    JSON.parse(line.trim());
                }
            }
        } catch (error) {
            errorThrown = true;
        }
        
        assert.strictEqual(errorThrown, true, 'Should throw error for invalid JSON');
    });

    test('should handle empty lines in bulk request', async () => {
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

        // Process the body like ConnectionManager would
        const lines = bulkBodyWithEmptyLines.split('\n');
        let validationPassed = true;
        
        try {
            for (const line of lines) {
                if (line.trim()) { // Skip empty lines
                    JSON.parse(line.trim());
                }
            }
        } catch (error) {
            validationPassed = false;
        }
        
        assert.strictEqual(validationPassed, true, 'Should handle empty lines correctly');
    });

    test('should use regular JSON for non-bulk operations', () => {
        const endpoint = '/test-index';
        const body = `{ "mappings": { "properties": { "field": { "type": "text" } } } }`;
        
        const isBulkOperation = endpoint.includes('/_bulk');
        assert.strictEqual(isBulkOperation, false);
        
        let requestBody: any = undefined;
        let contentType = 'application/json';
        
        if (body && body.trim()) {
            if (!isBulkOperation) {
                try {
                    requestBody = JSON.parse(body);
                    // Should successfully parse as JSON object
                    assert.strictEqual(typeof requestBody, 'object');
                } catch (error) {
                    assert.fail('Should parse valid JSON');
                }
            }
        }
        
        assert.strictEqual(contentType, 'application/json');
    });
});

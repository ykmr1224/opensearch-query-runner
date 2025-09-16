import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { OpenSearchConfig, ConnectionTestResult, OpenSearchResponse, ConnectionOverrides } from './types';
import { ErrorHandler } from './utils/errorHandler';
import { RequestInfoBuilder } from './utils/requestInfoBuilder';
import { ConnectionInfoManager } from './utils/connectionInfoManager';

export class ConnectionManager {
    private axiosInstance: AxiosInstance | null = null;
    private config: OpenSearchConfig | null = null;

    constructor() {
        this.updateConfiguration();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('opensearch')) {
                this.updateConfiguration();
            }
        });
    }

    private updateConfiguration(): void {
        const workspaceConfig = vscode.workspace.getConfiguration('opensearch');
        
        this.config = {
            endpoint: workspaceConfig.get('endpoint', 'http://localhost:9200'),
            auth: {
                type: workspaceConfig.get('auth.type', 'none'),
                username: workspaceConfig.get('auth.username', ''),
                password: workspaceConfig.get('auth.password', ''),
                apiKey: workspaceConfig.get('auth.apiKey', '')
            },
            timeout: workspaceConfig.get('timeout', 30000),
            maxHistoryItems: workspaceConfig.get('maxHistoryItems', 100),
            enableCodeLens: workspaceConfig.get('enableCodeLens', true)
        };

        this.createAxiosInstance();
    }

    private createAxiosInstance(): void {
        if (!this.config) {
            return;
        }

        const axiosConfig: AxiosRequestConfig = {
            baseURL: this.config.endpoint,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Configure authentication
        switch (this.config.auth.type) {
            case 'basic':
                if (this.config.auth.username && this.config.auth.password) {
                    axiosConfig.auth = {
                        username: this.config.auth.username,
                        password: this.config.auth.password
                    };
                }
                break;
            case 'apikey':
                if (this.config.auth.apiKey) {
                    axiosConfig.headers = {
                        ...axiosConfig.headers,
                        'Authorization': `ApiKey ${this.config.auth.apiKey}`
                    };
                }
                break;
        }

        this.axiosInstance = axios.create(axiosConfig);
    }

    public getConfig(): OpenSearchConfig | null {
        return this.config;
    }

    private getAuthHeaders(overrides?: ConnectionOverrides): Record<string, string> {
        if (!this.config) {
            return {};
        }

        return RequestInfoBuilder.buildAuthHeaders(this.config.auth, overrides);
    }

    /**
     * Helper method to add request and response info to a result
     */
    private addRequestResponseInfo(
        result: any,
        method: string,
        endpoint: string,
        headers: Record<string, string>,
        body: string,
        axiosResponse: any
    ): any {
        result.requestInfo = {
            method: method.toUpperCase(),
            endpoint,
            headers,
            body
        };
        result.responseInfo = {
            status: axiosResponse.status,
            statusText: axiosResponse.statusText,
            headers: axiosResponse.headers
        };
        return result;
    }

    /**
     * Helper method to create error response with all necessary info
     */
    private createErrorResponse(
        error: any,
        method: string,
        endpoint: string,
        headers: Record<string, string>,
        body: string,
        overrides?: ConnectionOverrides
    ): any {
        const errorResponse: any = {
            error: {
                type: error.response?.data?.error?.type || error.code || 'RequestError',
                reason: error.response?.data?.error?.reason || error.message,
                details: error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message
            }
        };

        // Add request info
        errorResponse.requestInfo = {
            method: method.toUpperCase(),
            endpoint,
            headers,
            body
        };

        // Add response info if available
        if (error.response) {
            errorResponse.responseInfo = {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers
            };
            if (error.response.data) {
                errorResponse.rawResponse = error.response.data;
            }
        }

        // Add connection info
        return ConnectionInfoManager.addConnectionInfo(errorResponse, this.config, overrides);
    }

    public async testConnection(): Promise<ConnectionTestResult> {
        if (!this.axiosInstance) {
            return {
                success: false,
                error: 'No connection configured'
            };
        }

        try {
            const response = await this.axiosInstance.get('/_cluster/health');
            const healthData = response.data;

            return {
                success: true,
                clusterName: healthData.cluster_name,
                version: healthData.version?.number
            };
        } catch (error: any) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }

    public async executeQuery(query: string, queryType: 'sql' | 'ppl'): Promise<OpenSearchResponse & { requestInfo?: any, responseInfo?: any }> {
        if (!this.axiosInstance) {
            throw new Error('No connection configured');
        }

        const endpoint = queryType === 'sql' ? '/_plugins/_sql' : '/_plugins/_ppl';
        const payload = { query };
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
        };
        const body = JSON.stringify(payload, null, 2);

        try {
            const response = await this.axiosInstance.post(endpoint, payload);
            const result = this.addRequestResponseInfo(response.data, 'POST', endpoint, headers, body, response);
            return ConnectionInfoManager.addConnectionInfo(result, this.config);
        } catch (error: any) {
            return this.createErrorResponse(error, 'POST', endpoint, headers, body);
        }
    }

    public async executeApiOperation(method: string, endpoint: string, body?: string): Promise<OpenSearchResponse & { requestInfo?: any, responseInfo?: any }> {
        if (!this.axiosInstance) {
            throw new Error('No connection configured');
        }

        // Determine if this is a bulk operation and prepare request body
        let requestBody: any = undefined;
        let contentType = 'application/json';
        
        if (body && body.trim()) {
            const isBulkOperation = endpoint.includes('/_bulk');
            
            if (isBulkOperation) {
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
                
                // Ensure the body ends with a newline (required for bulk API)
                if (!processedBody.endsWith('\n')) {
                    processedBody += '\n';
                }
                
                requestBody = processedBody;
                contentType = 'application/x-ndjson';
            } else {
                try {
                    requestBody = JSON.parse(body);
                } catch (error) {
                    throw new Error('Invalid JSON in request body');
                }
            }
        }

        const requestHeaders = {
            'Content-Type': contentType,
            ...this.getAuthHeaders()
        };

        const requestConfig: any = {
            method: method.toLowerCase(),
            url: endpoint,
            data: requestBody,
            headers: requestHeaders
        };

        // For bulk operations, prevent axios from transforming the request data
        if (endpoint.includes('/_bulk')) {
            requestConfig.transformRequest = [(data: any) => data];
        }

        try {
            const response = await this.axiosInstance.request(requestConfig);
            const result = this.addRequestResponseInfo(response.data, method, endpoint, requestHeaders, body || '', response);
            return ConnectionInfoManager.addConnectionInfo(result, this.config);
        } catch (error: any) {
            return this.createErrorResponse(error, method, endpoint, requestHeaders, body || '');
        }
    }

    public async executeQueryWithOverrides(
        query: string, 
        queryType: 'sql' | 'ppl', 
        overrides?: ConnectionOverrides
    ): Promise<OpenSearchResponse & { requestInfo?: any, responseInfo?: any }> {
        const axiosInstance = overrides ? 
            this.createAxiosInstanceWithOverrides(overrides) : 
            this.axiosInstance;

        if (!axiosInstance) {
            throw new Error('No connection configured');
        }

        const endpoint = queryType === 'sql' ? '/_plugins/_sql' : '/_plugins/_ppl';
        const payload = { query };
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(overrides)
        };
        const body = JSON.stringify(payload, null, 2);

        try {
            const response = await axiosInstance.post(endpoint, payload);
            const result = this.addRequestResponseInfo(response.data, 'POST', endpoint, headers, body, response);
            return ConnectionInfoManager.addConnectionInfo(result, this.config, overrides);
        } catch (error: any) {
            return this.createErrorResponse(error, 'POST', endpoint, headers, body, overrides);
        }
    }

    public async executeExplainQueryWithOverrides(
        query: string, 
        queryType: 'sql' | 'ppl', 
        overrides?: ConnectionOverrides
    ): Promise<OpenSearchResponse & { requestInfo?: any, responseInfo?: any }> {
        const axiosInstance = overrides ? 
            this.createAxiosInstanceWithOverrides(overrides) : 
            this.axiosInstance;

        if (!axiosInstance) {
            throw new Error('No connection configured');
        }

        const endpoint = queryType === 'sql' ? '/_plugins/_sql/_explain' : '/_plugins/_ppl/_explain';
        const payload = { query };
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(overrides)
        };
        const body = JSON.stringify(payload, null, 2);

        try {
            const response = await axiosInstance.post(endpoint, payload);
            const result = this.addRequestResponseInfo(response.data, 'POST', endpoint, headers, body, response);
            return ConnectionInfoManager.addConnectionInfo(result, this.config, overrides);
        } catch (error: any) {
            return this.createErrorResponse(error, 'POST', endpoint, headers, body, overrides);
        }
    }

    public async executeApiOperationWithOverrides(
        method: string, 
        endpoint: string, 
        body?: string, 
        overrides?: ConnectionOverrides
    ): Promise<OpenSearchResponse & { requestInfo?: any, responseInfo?: any }> {
        const axiosInstance = overrides ? 
            this.createAxiosInstanceWithOverrides(overrides) : 
            this.axiosInstance;

        if (!axiosInstance) {
            throw new Error('No connection configured');
        }

        // Determine if this is a bulk operation and prepare request body
        let requestBody: any = undefined;
        let contentType = 'application/json';
        
        if (body && body.trim()) {
            const isBulkOperation = endpoint.includes('/_bulk');
            
            if (isBulkOperation) {
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
                
                // Ensure the body ends with a newline (required for bulk API)
                if (!processedBody.endsWith('\n')) {
                    processedBody += '\n';
                }
                
                requestBody = processedBody;
                contentType = 'application/x-ndjson';
            } else {
                try {
                    requestBody = JSON.parse(body);
                } catch (error) {
                    throw new Error('Invalid JSON in request body');
                }
            }
        }

        const requestHeaders = {
            'Content-Type': contentType,
            ...this.getAuthHeaders(overrides)
        };

        const requestConfig: any = {
            method: method.toLowerCase(),
            url: endpoint,
            data: requestBody,
            headers: requestHeaders
        };

        // For bulk operations, prevent axios from transforming the request data
        if (endpoint.includes('/_bulk')) {
            requestConfig.transformRequest = [(data: any) => data];
        }

        try {
            const response = await axiosInstance.request(requestConfig);
            const result = this.addRequestResponseInfo(response.data, method, endpoint, requestHeaders, body || '', response);
            return ConnectionInfoManager.addConnectionInfo(result, this.config, overrides);
        } catch (error: any) {
            return this.createErrorResponse(error, method, endpoint, requestHeaders, body || '', overrides);
        }
    }

    private formatError(error: any): string {
        if (error.response) {
            const status = error.response.status;
            const statusText = error.response.statusText;
            const data = error.response.data;
            
            if (data && data.error) {
                return `${status} ${statusText}: ${data.error.reason || data.error.type || 'Unknown error'}`;
            }
            
            return `${status} ${statusText}`;
        } else if (error.request) {
            return 'Network error: Unable to connect to OpenSearch cluster';
        } else {
            return error.message || 'Unknown error occurred';
        }
    }

    private createAxiosInstanceWithOverrides(overrides: ConnectionOverrides): AxiosInstance {
        if (!this.config) {
            throw new Error('No base configuration available');
        }

        // Merge base config with overrides
        const mergedConfig = {
            endpoint: overrides.endpoint || this.config.endpoint,
            auth: {
                type: overrides.auth?.type || this.config.auth.type,
                username: overrides.auth?.username || this.config.auth.username,
                password: overrides.auth?.password || this.config.auth.password,
                apiKey: overrides.auth?.apiKey || this.config.auth.apiKey
            },
            timeout: overrides.timeout || this.config.timeout
        };

        const axiosConfig: AxiosRequestConfig = {
            baseURL: mergedConfig.endpoint,
            timeout: mergedConfig.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Configure authentication with merged config
        switch (mergedConfig.auth.type) {
            case 'basic':
                if (mergedConfig.auth.username && mergedConfig.auth.password) {
                    axiosConfig.auth = {
                        username: mergedConfig.auth.username,
                        password: mergedConfig.auth.password
                    };
                }
                break;
            case 'apikey':
                if (mergedConfig.auth.apiKey) {
                    axiosConfig.headers = {
                        ...axiosConfig.headers,
                        'Authorization': `ApiKey ${mergedConfig.auth.apiKey}`
                    };
                }
                break;
        }

        return axios.create(axiosConfig);
    }

    public async testConnectionWithOverrides(overrides: ConnectionOverrides): Promise<ConnectionTestResult> {
        try {
            const axiosInstance = this.createAxiosInstanceWithOverrides(overrides);
            const response = await axiosInstance.get('/_cluster/health');
            const healthData = response.data;

            return {
                success: true,
                clusterName: healthData.cluster_name,
                version: healthData.version?.number
            };
        } catch (error: any) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }

    public async configureConnection(): Promise<void> {
        const endpoint = await vscode.window.showInputBox({
            prompt: 'Enter OpenSearch endpoint URL',
            value: this.config?.endpoint || 'http://localhost:9200',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });

        if (!endpoint) {
            return;
        }

        const authType = await vscode.window.showQuickPick([
            { label: 'None', value: 'none' },
            { label: 'Basic Authentication', value: 'basic' },
            { label: 'API Key', value: 'apikey' }
        ], {
            placeHolder: 'Select authentication type'
        });

        if (!authType) {
            return;
        }

        const config = vscode.workspace.getConfiguration('opensearch');
        await config.update('endpoint', endpoint, vscode.ConfigurationTarget.Workspace);
        await config.update('auth.type', authType.value, vscode.ConfigurationTarget.Workspace);

        if (authType.value === 'basic') {
            const username = await vscode.window.showInputBox({
                prompt: 'Enter username',
                ignoreFocusOut: true
            });

            const password = await vscode.window.showInputBox({
                prompt: 'Enter password',
                password: true,
                ignoreFocusOut: true
            });

            if (username && password) {
                await config.update('auth.username', username, vscode.ConfigurationTarget.Workspace);
                await config.update('auth.password', password, vscode.ConfigurationTarget.Workspace);
            }
        } else if (authType.value === 'apikey') {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter API key',
                password: true,
                ignoreFocusOut: true
            });

            if (apiKey) {
                await config.update('auth.apiKey', apiKey, vscode.ConfigurationTarget.Workspace);
            }
        }

        vscode.window.showInformationMessage('OpenSearch connection configured successfully!');
        
        // Test the connection
        const testResult = await this.testConnection();
        if (testResult.success) {
            vscode.window.showInformationMessage(
                `Connected to OpenSearch cluster: ${testResult.clusterName}`
            );
        } else {
            vscode.window.showWarningMessage(
                `Connection test failed: ${testResult.error}`
            );
        }
    }
}

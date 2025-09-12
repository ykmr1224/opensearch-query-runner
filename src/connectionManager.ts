import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { OpenSearchConfig, ConnectionTestResult, OpenSearchResponse } from './types';

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

    public async executeQuery(query: string, queryType: 'sql' | 'ppl'): Promise<OpenSearchResponse> {
        if (!this.axiosInstance) {
            throw new Error('No connection configured');
        }

        const endpoint = queryType === 'sql' ? '/_plugins/_sql' : '/_plugins/_ppl';
        const payload = { query };

        try {
            const response = await this.axiosInstance.post(endpoint, payload);
            return response.data;
        } catch (error: any) {
            if (error.response?.data) {
                return {
                    error: {
                        type: error.response.data.error?.type || 'RequestError',
                        reason: error.response.data.error?.reason || error.message,
                        details: JSON.stringify(error.response.data, null, 2)
                    }
                };
            }
            throw error;
        }
    }

    public async executeApiOperation(method: string, endpoint: string, body?: string): Promise<OpenSearchResponse & { requestInfo?: any }> {
        if (!this.axiosInstance) {
            throw new Error('No connection configured');
        }

        try {
            let requestBody: any = undefined;
            let contentType = 'application/json';
            
            if (body && body.trim()) {
                // Check if this is a bulk operation (contains newline-delimited JSON)
                const isBulkOperation = endpoint.includes('/_bulk') || 
                    (body.includes('\n') && body.split('\n').every(line => {
                        if (!line.trim()) return true; // Allow empty lines
                        try {
                            JSON.parse(line);
                            return true;
                        } catch {
                            return false;
                        }
                    }));

                if (isBulkOperation) {
                    // For bulk operations, use the raw body as string with NDJSON content type
                    requestBody = body;
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

            const requestConfig = {
                method: method.toLowerCase(),
                url: endpoint,
                data: requestBody,
                headers: {
                    'Content-Type': contentType
                }
            };

            const response = await this.axiosInstance.request(requestConfig);

            // Add request info to the response for debugging
            const result = response.data;
            result.requestInfo = {
                method: method.toUpperCase(),
                endpoint: endpoint,
                headers: requestConfig.headers,
                body: body
            };

            return result;
        } catch (error: any) {
            let contentType = 'application/json';
            
            // Determine content type for error reporting
            if (body && body.trim()) {
                const isBulkOperation = endpoint.includes('/_bulk') || 
                    (body.includes('\n') && body.split('\n').every(line => {
                        if (!line.trim()) return true;
                        try {
                            JSON.parse(line);
                            return true;
                        } catch {
                            return false;
                        }
                    }));
                
                if (isBulkOperation) {
                    contentType = 'application/x-ndjson';
                }
            }

            const errorResponse: any = {
                error: {
                    type: error.response?.data?.error?.type || 'RequestError',
                    reason: error.response?.data?.error?.reason || error.message,
                    details: error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message
                }
            };

            // Add request info even for errors
            errorResponse.requestInfo = {
                method: method.toUpperCase(),
                endpoint: endpoint,
                headers: { 'Content-Type': contentType },
                body: body
            };

            return errorResponse;
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

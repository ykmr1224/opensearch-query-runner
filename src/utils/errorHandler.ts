import { QueryResult } from '../types';
import { ConnectionInfoManager } from './connectionInfoManager';

export class ErrorHandler {
    /**
     * Extract request and response information from an axios error
     */
    public static extractErrorInfo(error: any): {
        requestInfo?: QueryResult['requestInfo'];
        responseInfo?: QueryResult['responseInfo'];
        rawResponse?: any;
    } {
        let requestInfo: QueryResult['requestInfo'] | undefined = undefined;
        let responseInfo: QueryResult['responseInfo'] | undefined = undefined;
        let rawResponse: any = undefined;
        
        if (error.response) {
            // This is likely an axios error with response info
            responseInfo = {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers
            };
            rawResponse = error.response.data;
        }
        
        if (error.config) {
            // This is likely an axios error with request config
            requestInfo = {
                method: error.config.method?.toUpperCase(),
                endpoint: error.config.url,
                headers: error.config.headers,
                body: error.config.data ? 
                    (typeof error.config.data === 'string' ? 
                        error.config.data : 
                        JSON.stringify(error.config.data, null, 2)
                    ) : undefined
            };
        }
        
        return { requestInfo, responseInfo, rawResponse };
    }

    /**
     * Create a standardized error response
     */
    public static createErrorResponse(
        error: any,
        startTime: number,
        customMessage?: string,
        connectionInfo?: QueryResult['connectionInfo']
    ): QueryResult {
        const { requestInfo, responseInfo, rawResponse } = this.extractErrorInfo(error);
        
        // Create enhanced error details
        const enhancedErrorDetails = this.createEnhancedErrorDetails(error);
        
        const errorResponse: QueryResult = {
            success: false,
            error: customMessage || this.formatError(error),
            executionTime: Date.now() - startTime,
            executedAt: new Date(startTime),
            requestInfo,
            responseInfo,
            rawResponse: rawResponse || {
                error: {
                    details: enhancedErrorDetails
                }
            }
        };

        // Add connection info if provided
        if (connectionInfo) {
            errorResponse.connectionInfo = connectionInfo;
        }

        return errorResponse;
    }

    /**
     * Create a standardized error response from OpenSearch API response
     */
    public static createApiErrorResponse(
        response: any,
        startTime: number
    ): QueryResult {
        const errorResponse: QueryResult = {
            success: false,
            error: `${response.error.type}: ${response.error.reason}`,
            executionTime: Date.now() - startTime,
            executedAt: new Date(startTime),
            rawResponse: response
        };
        
        // Add request info if available
        if (response.requestInfo) {
            errorResponse.requestInfo = response.requestInfo;
        }
        
        // Add response info if available
        if (response.responseInfo) {
            errorResponse.responseInfo = response.responseInfo;
        }
        
        // Add connection info if available
        if (response.connectionInfo) {
            errorResponse.connectionInfo = response.connectionInfo;
        }
        
        return errorResponse;
    }

    /**
     * Format error message from various error sources
     */
    public static formatError(error: any): string {
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

    /**
     * Create enhanced error details for connection and axios errors
     */
    public static createEnhancedErrorDetails(error: any): any {
        const errorDetails: any = {
            errorType: 'Unknown',
            message: error.message || 'Unknown error occurred',
            timestamp: new Date().toISOString()
        };

        if (error.code) {
            errorDetails.code = error.code;
        }

        if (error.response) {
            // Server responded with error status
            errorDetails.errorType = 'HTTP Response Error';
            errorDetails.status = error.response.status;
            errorDetails.statusText = error.response.statusText;
            errorDetails.url = error.config?.url || 'Unknown URL';
            errorDetails.method = error.config?.method?.toUpperCase() || 'Unknown Method';
            
            if (error.response.data) {
                errorDetails.serverResponse = error.response.data;
            }
            
            if (error.response.headers) {
                errorDetails.responseHeaders = error.response.headers;
            }
        } else if (error.request) {
            // Request was made but no response received (connection issues)
            errorDetails.errorType = 'Network/Connection Error';
            errorDetails.url = error.config?.url || 'Unknown URL';
            errorDetails.method = error.config?.method?.toUpperCase() || 'Unknown Method';
            
            // Add specific connection error details
            if (error.type === 'ECONNREFUSED') {
                errorDetails.details = 'Connection refused - server may be down or unreachable';
            } else if (error.type === 'ENOTFOUND') {
                errorDetails.details = 'DNS resolution failed - hostname not found';
            } else if (error.type === 'ETIMEDOUT') {
                errorDetails.details = 'Connection timeout - server took too long to respond';
            } else if (error.type === 'ECONNRESET') {
                errorDetails.details = 'Connection reset by server';
            } else if (error.type === 'CERT_HAS_EXPIRED') {
                errorDetails.details = 'SSL certificate has expired';
            } else if (error.type === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                errorDetails.details = 'SSL certificate verification failed';
            } else {
                errorDetails.details = 'Network request failed - check connection and server availability';
            }
            
            if (error.config?.timeout) {
                errorDetails.timeout = `${error.config.timeout}ms`;
            }
        } else {
            // Something else happened
            errorDetails.errorType = 'Request Setup Error';
            errorDetails.details = 'Error occurred while setting up the request';
        }

        // Add request configuration details if available
        if (error.config) {
            errorDetails.requestConfig = {
                url: error.config.url,
                method: error.config.method?.toUpperCase(),
                timeout: error.config.timeout,
                headers: error.config.headers
            };
            
            if (error.config.data) {
                errorDetails.requestConfig.body = typeof error.config.data === 'string' 
                    ? error.config.data 
                    : JSON.stringify(error.config.data, null, 2);
            }
        }

        return errorDetails;
    }
}

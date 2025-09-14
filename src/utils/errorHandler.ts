import { QueryResult } from '../types';

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
        customMessage?: string
    ): QueryResult {
        const { requestInfo, responseInfo, rawResponse } = this.extractErrorInfo(error);
        
        return {
            success: false,
            error: customMessage || error.message || 'Unknown error occurred',
            executionTime: Date.now() - startTime,
            executedAt: new Date(startTime),
            requestInfo,
            responseInfo,
            rawResponse
        };
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
}

import { ConnectionOverrides, QueryResult } from '../types';
import { JsonUtils } from './jsonUtils';

export class RequestInfoBuilder {
    /**
     * Build auth headers for a specific configuration (with overrides)
     */
    public static buildAuthHeaders(
        baseAuth: { type: string; username?: string; password?: string; apiKey?: string },
        overrides?: ConnectionOverrides
    ): Record<string, string> {
        const headers: Record<string, string> = {};
        
        // Merge auth config
        const authType = overrides?.auth?.type || baseAuth.type;
        const username = overrides?.auth?.username || baseAuth.username;
        const password = overrides?.auth?.password || baseAuth.password;
        const apiKey = overrides?.auth?.apiKey || baseAuth.apiKey;
        
        switch (authType) {
            case 'basic':
                if (username && password) {
                    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
                    headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
            case 'apikey':
                if (apiKey) {
                    headers['Authorization'] = `ApiKey ${apiKey}`;
                }
                break;
        }
        
        return headers;
    }

    /**
     * Build request info for query operations
     */
    public static buildQueryRequestInfo(
        queryType: 'sql' | 'ppl',
        query: string,
        authHeaders: Record<string, string>,
        isExplain: boolean = false
    ): QueryResult['requestInfo'] {
        const endpoint = isExplain 
            ? (queryType === 'sql' ? '/_plugins/_sql/_explain' : '/_plugins/_ppl/_explain')
            : (queryType === 'sql' ? '/_plugins/_sql' : '/_plugins/_ppl');
        
        const payload = { query };

        return {
            method: 'POST',
            endpoint: endpoint,
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify(payload, null, 2)
        };
    }

    /**
     * Build request info for API operations
     */
    public static buildApiRequestInfo(
        method: string,
        endpoint: string,
        body: string | undefined,
        authHeaders: Record<string, string>
    ): QueryResult['requestInfo'] {
        // Determine content type based on operation type
        const isBulkOperation = endpoint.includes('/_bulk');
        const contentType = isBulkOperation ? 'application/x-ndjson' : 'application/json';

        return {
            method: method.toUpperCase(),
            endpoint: endpoint,
            headers: {
                'Content-Type': contentType,
                ...authHeaders
            },
            body: body || ''
        };
    }

    /**
     * Add request info to a response object
     */
    public static addRequestInfoToResponse(
        response: any,
        requestInfo: QueryResult['requestInfo']
    ): any {
        response.requestInfo = requestInfo;
        return response;
    }

    /**
     * Add response info to a response object
     */
    public static addResponseInfoToResponse(
        response: any,
        axiosResponse: any
    ): any {
        response.responseInfo = {
            status: axiosResponse.status,
            statusText: axiosResponse.statusText,
            headers: axiosResponse.headers
        };
        return response;
    }

    /**
     * Process bulk operation body to ensure proper NDJSON format
     */
    public static processBulkBody(body: string): string {
        let processedBody = body.trim();
        
        // Validate using centralized JSON utilities
        const validation = JsonUtils.validateBulkJSON(processedBody);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Ensure the body ends with a newline (required for bulk API)
        if (!processedBody.endsWith('\n')) {
            processedBody += '\n';
        }
        
        return processedBody;
    }

    /**
     * Validate and parse JSON body for regular API operations
     */
    public static validateJsonBody(body: string): any {
        const result = JsonUtils.validateAndParse(body);
        if (!result.valid) {
            throw new Error('Invalid JSON in request body');
        }
        return result.data;
    }
}

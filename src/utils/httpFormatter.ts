import { QueryResult } from '../types';
import { YamlConverter } from './yamlConverter';

export class HttpFormatter {
    /**
     * Formats HTTP request information as a raw HTTP request string
     */
    public static formatRawRequest(requestInfo: QueryResult['requestInfo']): string {
        if (!requestInfo) {
            return 'No request information available';
        }

        const { method, endpoint, headers, body } = requestInfo;
        
        let rawRequest = `${method || 'POST'} ${endpoint || '/'} HTTP/1.1\n`;

        if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
                rawRequest += `${key}: ${value}\n`;
            });
        }
        
        // Empty line between headers and body
        rawRequest += '\n';
        
        if (body) {
            rawRequest += body;
        }

        return rawRequest;
    }

    /**
     * Formats HTTP response information as a raw HTTP response string
     */
    public static formatRawResponse(result: QueryResult): string {
        if (!result.responseInfo && !result.rawResponse) {
            return 'No response information available';
        }

        if (!result.responseInfo) {
            // If we only have raw response, return it as JSON
            return result.rawResponse ? JSON.stringify(result.rawResponse, null, 2) : 'No response data';
        }

        const { status, statusText, headers } = result.responseInfo;
        
        let rawResponse = `HTTP/1.1 ${status || 200} ${statusText || 'OK'}\n`;

        if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
                rawResponse += `${key}: ${value}\n`;
            });
        }
        
        // Empty line between headers and body
        rawResponse += '\n';
        
        if (result.rawResponse) {
            rawResponse += JSON.stringify(result.rawResponse, null, 2);
        }

        return rawResponse;
    }

    /**
     * Generates HTML section for raw HTTP request
     */
    public static generateRawRequestSection(result: QueryResult): string {
        const rawRequest = this.formatRawRequest(result.requestInfo);
        
        let content = `
            <div class="debug-section">
        `;

        // Add connection information if available
        if (result.connectionInfo) {
            const connectionId = `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const connectionCopyId = `copy-connection-${connectionId}`;
            
            content += `
                <div class="debug-item">
                    <h3>🔗 Connection Information</h3>
                    <div class="copyable-container">
                        <div class="copy-header">
                            <button id="${connectionCopyId}" class="copy-btn" onclick="copyToClipboard('${connectionId}', '${connectionCopyId}')">Copy</button>
                        </div>
                        <div id="${connectionId}" class="json-container">
                            <pre>Endpoint: ${result.connectionInfo.endpoint}
Auth: ${result.connectionInfo.authType}</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        const rawRequestId = `raw-request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const rawRequestCopyId = `copy-raw-request-${rawRequestId}`;

        content += `
                <div class="debug-item">
                    <h3>📤 Raw HTTP Request</h3>
                    <div class="copyable-container">
                        <div class="copy-header">
                            <button id="${rawRequestCopyId}" class="copy-btn" onclick="copyToClipboard('${rawRequestId}', '${rawRequestCopyId}')">Copy</button>
                        </div>
                        <div id="${rawRequestId}" class="json-container">
                            <pre>${rawRequest}</pre>
                        </div>
                    </div>
                </div>
        `;

        // Add request details with YAML conversion if available
        if (result.requestInfo) {
            const requestDetailsJson = JSON.stringify(result.requestInfo, null, 2);
            const requestDetailsContainerId = YamlConverter.generateContentId();
            
            content += `
                <div class="debug-item">
                    <h3>🔧 Request Details</h3>
                    ${YamlConverter.createToggleContainer(requestDetailsJson, requestDetailsContainerId)}
                </div>
            `;
        } else {
            const noRequestId = `no-request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const noRequestCopyId = `copy-no-request-${noRequestId}`;
            
            content += `
                <div class="debug-item">
                    <h3>🔧 Request Details</h3>
                    <div class="copyable-container">
                        <div class="copy-header">
                            <button id="${noRequestCopyId}" class="copy-btn" onclick="copyToClipboard('${noRequestId}', '${noRequestCopyId}')">Copy</button>
                        </div>
                        <div id="${noRequestId}" class="json-container">
                            <pre>No request details available</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        content += '</div>';
        return content;
    }

    /**
     * Generates HTML section for raw HTTP response
     */
    public static generateRawResponseSection(result: QueryResult): string {
        if (!result.responseInfo && !result.rawResponse) {
            const noResponseId = `no-response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const noResponseCopyId = `copy-no-response-${noResponseId}`;
            
            return `
                <div class="debug-section">
                    <div class="debug-item">
                        <h3>📥 Raw HTTP Response</h3>
                        <div class="copyable-container">
                            <div class="copy-header">
                                <button id="${noResponseCopyId}" class="copy-btn" onclick="copyToClipboard('${noResponseId}', '${noResponseCopyId}')">Copy</button>
                            </div>
                            <div id="${noResponseId}" class="json-container">
                                <pre>No response information available</pre>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        let content = '<div class="debug-section">';

        // Add raw HTTP response if we have response info
        if (result.responseInfo) {
            const rawResponse = this.formatRawResponse(result);
            const rawResponseId = `raw-response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const rawResponseCopyId = `copy-raw-response-${rawResponseId}`;
            
            content += `
                <div class="debug-item">
                    <h3>📥 Raw HTTP Response</h3>
                    <div class="copyable-container">
                        <div class="copy-header">
                            <button id="${rawResponseCopyId}" class="copy-btn" onclick="copyToClipboard('${rawResponseId}', '${rawResponseCopyId}')">Copy</button>
                        </div>
                        <div id="${rawResponseId}" class="json-container">
                            <pre>${rawResponse}</pre>
                        </div>
                    </div>
                </div>
            `;
        }

        // Add response details
        if (result.responseInfo) {
            const responseDetailsJson = JSON.stringify(result.responseInfo, null, 2);
            const responseDetailsContainerId = YamlConverter.generateContentId();
            
            content += `
                <div class="debug-item">
                    <h3>🔧 Response Details</h3>
                    ${YamlConverter.createToggleContainer(responseDetailsJson, responseDetailsContainerId)}
                </div>
            `;
        }

        // Add raw response body
        if (result.rawResponse) {
            const responseBodyJson = JSON.stringify(result.rawResponse, null, 2);
            const responseBodyContainerId = YamlConverter.generateContentId();
            
            content += `
                <div class="debug-item">
                    <h3>📄 Response Body</h3>
                    ${YamlConverter.createToggleContainer(responseBodyJson, responseBodyContainerId)}
                </div>
            `;
        }

        content += '</div>';
        return content;
    }

    /**
     * Generates curl command equivalent for the HTTP request
     */
    public static generateCurlCommand(requestInfo: QueryResult['requestInfo']): string {
        if (!requestInfo) {
            return 'curl command not available - no request information';
        }

        const { method, endpoint, headers, body } = requestInfo;
        
        let curlCommand = `curl -X ${method || 'POST'}`;
        
        // Add headers
        if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
                curlCommand += ` \\\n  -H "${key}: ${value}"`;
            });
        }
        
        // Add body if present
        if (body) {
            curlCommand += ` \\\n  -d '${body}'`;
        }
        
        // Add endpoint
        curlCommand += ` \\\n  "${endpoint || 'http://localhost:9200'}"`;
        
        return curlCommand;
    }

    /**
     * Generates metadata badges for query results
     */
    public static generateMetadata(result: QueryResult, explainResult?: QueryResult): string {
        const items = [];
        
        if (result.success) {
            items.push(`<span class="metadata-item success">✅ Success</span>`);
        } else {
            items.push(`<span class="metadata-item error">❌ Error</span>`);
        }
        
        items.push(`<span class="metadata-item">⏱️ ${result.executionTime}ms</span>`);
        
        if (result.rowCount !== undefined) {
            items.push(`<span class="metadata-item">📊 ${result.rowCount} rows</span>`);
        }
        
        if (explainResult) {
            if (explainResult.success) {
                items.push(`<span class="metadata-item">🔍 Explain: ${explainResult.executionTime}ms</span>`);
            } else {
                items.push(`<span class="metadata-item error">🔍 Explain: Failed</span>`);
            }
        }
        
        return `
            <div class="metadata">
                ${items.join('\n                ')}
            </div>
        `;
    }
}

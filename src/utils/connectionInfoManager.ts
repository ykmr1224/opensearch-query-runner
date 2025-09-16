import { QueryResult, OpenSearchConfig, ConnectionOverrides } from '../types';

export class ConnectionInfoManager {
    /**
     * Creates connection info object from config and overrides
     */
    public static createConnectionInfo(
        config: OpenSearchConfig | null,
        overrides?: ConnectionOverrides
    ): QueryResult['connectionInfo'] {
        if (!config) {
            return {
                endpoint: 'Unknown',
                authType: 'none'
            };
        }

        return {
            endpoint: overrides?.endpoint || config.endpoint,
            authType: overrides?.auth?.type || config.auth.type
        };
    }

    /**
     * Adds connection info to any response object
     */
    public static addConnectionInfo(
        response: any,
        config: OpenSearchConfig | null,
        overrides?: ConnectionOverrides
    ): any {
        response.connectionInfo = this.createConnectionInfo(config, overrides);
        return response;
    }

    /**
     * Preserves connection info from source to target object
     */
    public static preserveConnectionInfo(source: any, target: QueryResult): QueryResult {
        if (source.connectionInfo) {
            target.connectionInfo = source.connectionInfo;
        }
        if (source.requestInfo) {
            target.requestInfo = source.requestInfo;
        }
        if (source.responseInfo) {
            target.responseInfo = source.responseInfo;
        }
        return target;
    }

    /**
     * Ensures a QueryResult has all necessary connection information
     */
    public static ensureConnectionInfo(
        result: QueryResult,
        config: OpenSearchConfig | null,
        overrides?: ConnectionOverrides
    ): QueryResult {
        if (!result.connectionInfo) {
            result.connectionInfo = this.createConnectionInfo(config, overrides);
        }
        return result;
    }
}

import * as vscode from 'vscode';

export interface OpenSearchConfig {
    endpoint: string;
    auth: {
        type: 'none' | 'basic' | 'apikey';
        username?: string;
        password?: string;
        apiKey?: string;
    };
    timeout: number;
    maxHistoryItems: number;
    enableCodeLens: boolean;
}

export interface ConnectionOverrides {
    endpoint?: string;
    auth?: {
        type?: 'none' | 'basic' | 'apikey';
        username?: string;
        password?: string;
        apiKey?: string;
    };
    timeout?: number;
}

export interface ConfigurationBlock {
    config: ConnectionOverrides;
    range: vscode.Range;
    position: number;
}

export interface QueryBlock {
    type: 'sql' | 'ppl' | 'opensearch-api';
    content: string;
    range: vscode.Range;
    metadata?: QueryMetadata;
    connectionOverrides?: ConnectionOverrides;
}

export interface QueryMetadata {
    connection?: string;
    timeout?: number;
    description?: string;
    method?: string;
    endpoint?: string;
}

export interface QueryResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
    rowCount?: number;
    columns?: string[];
    rawResponse?: any;
    requestInfo?: {
        method?: string;
        endpoint?: string;
        headers?: Record<string, string>;
        body?: string;
    };
    responseInfo?: {
        status?: number;
        statusText?: string;
        headers?: Record<string, string>;
    };
}

export interface QueryHistoryItem {
    id: string;
    query: string;
    queryType: 'sql' | 'ppl' | 'opensearch-api';
    timestamp: Date;
    result: QueryResult;
    endpoint: string;
}

export interface OpenSearchResponse {
    took?: number;
    timed_out?: boolean;
    _shards?: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
    hits?: {
        total: {
            value: number;
            relation: string;
        };
        max_score: number;
        hits: any[];
    };
    schema?: Array<{
        name: string;
        type: string;
    }>;
    datarows?: any[][];
    total?: number;
    size?: number;
    status?: number;
    error?: {
        type: string;
        reason: string;
        details?: string;
    };
}

export interface ConnectionTestResult {
    success: boolean;
    error?: string;
    clusterName?: string;
    version?: string;
}

export enum DisplayMode {
    Inline = 'inline',
    SeparateTab = 'separateTab'
}

export interface CodeLensCommand {
    title: string;
    command: string;
    arguments?: any[];
}

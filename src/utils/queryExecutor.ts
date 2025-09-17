import { QueryResult, ConnectionOverrides, QueryType } from '../types';
import { ErrorHandler } from './errorHandler';
import { ValidationPipeline, ValidationContext } from './validationPipeline';

export interface QueryExecutionContext {
    query: string;
    queryType: QueryType;
    timeout?: number;
    metadata?: any;
    connectionOverrides?: ConnectionOverrides;
    startTime: number;
}

export interface QueryExecutor {
    executeQuery(context: QueryExecutionContext): Promise<any>;
    executeExplainQuery(context: QueryExecutionContext): Promise<any>;
}

export class QueryExecutionEngine {
    /**
     * Executes a query with unified error handling and validation
     */
    public static async executeWithErrorHandling<T>(
        context: QueryExecutionContext,
        executor: (context: QueryExecutionContext) => Promise<T>,
        responseProcessor: (response: T, executionTime: number, queryType?: string, startTime?: number) => QueryResult
    ): Promise<QueryResult> {
        try {
            const response = await executor(context);
            const executionTime = Date.now() - context.startTime;

            if (response && (response as any).error) {
                return ErrorHandler.createApiErrorResponse(response, context.startTime);
            }

            const result = responseProcessor(response, executionTime, context.queryType, context.startTime);
            
            const responseWithInfo = response as any;
            if (responseWithInfo.requestInfo) {
                result.requestInfo = responseWithInfo.requestInfo;
            }
            
            if (responseWithInfo.responseInfo) {
                result.responseInfo = responseWithInfo.responseInfo;
            }
            
            return result;

        } catch (error: any) {
            return this.handleExecutionError(error, context.startTime);
        }
    }

    /**
     * Validates query before execution using ValidationPipeline
     */
    public static validateQuery(context: QueryExecutionContext): QueryResult | null {
        const validationContext: ValidationContext = {
            query: context.query,
            queryType: context.queryType,
            metadata: context.metadata,
            connectionOverrides: context.connectionOverrides,
            startTime: context.startTime
        };

        return ValidationPipeline.validateQuery(validationContext);
    }

    /**
     * Validates explain query before execution using ValidationPipeline
     */
    public static validateExplainQuery(context: QueryExecutionContext): QueryResult | null {
        const validationContext: ValidationContext = {
            query: context.query,
            queryType: context.queryType,
            metadata: context.metadata,
            connectionOverrides: context.connectionOverrides,
            startTime: context.startTime
        };

        return ValidationPipeline.validateExplainQuery(validationContext);
    }

    /**
     * Handles execution errors with unified error extraction
     */
    private static handleExecutionError(error: any, startTime: number): QueryResult {
        return ErrorHandler.createErrorResponse(error, startTime);
    }

    /**
     * Creates execution context from parameters
     */
    public static createContext(
        query: string,
        queryType: QueryType,
        timeout?: number,
        metadata?: any,
        connectionOverrides?: ConnectionOverrides
    ): QueryExecutionContext {
        return {
            query,
            queryType,
            timeout,
            metadata,
            connectionOverrides,
            startTime: Date.now()
        };
    }
}

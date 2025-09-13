import { QueryResult, ConnectionOverrides } from '../types';
import { MarkdownParser } from '../markdownParser';

export interface ValidationContext {
    query: string;
    queryType: 'sql' | 'ppl' | 'opensearch-api';
    metadata?: any;
    connectionOverrides?: ConnectionOverrides;
    startTime: number;
}

export interface ValidationRule {
    name: string;
    validate: (context: ValidationContext) => ValidationResult;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export class ValidationPipeline {
    private static readonly COMMON_RULES: ValidationRule[] = [
        {
            name: 'connection-overrides',
            validate: (context) => ValidationPipeline.validateConnectionOverrides(context)
        },
        {
            name: 'query-syntax',
            validate: (context) => ValidationPipeline.validateQuerySyntax(context)
        }
    ];

    private static readonly API_RULES: ValidationRule[] = [
        {
            name: 'api-metadata',
            validate: (context) => ValidationPipeline.validateApiMetadata(context)
        }
    ];

    private static readonly EXPLAIN_RULES: ValidationRule[] = [
        {
            name: 'explain-query-type',
            validate: (context) => ValidationPipeline.validateExplainQueryType(context)
        }
    ];

    /**
     * Validates a standard query using common rules and type-specific rules
     */
    public static validateQuery(context: ValidationContext): QueryResult | null {
        const rules = [...this.COMMON_RULES];
        
        // Add API-specific rules
        if (context.queryType === 'opensearch-api') {
            rules.push(...this.API_RULES);
        }

        return this.runValidationRules(context, rules);
    }

    /**
     * Validates an explain query using common rules and explain-specific rules
     */
    public static validateExplainQuery(context: ValidationContext): QueryResult | null {
        const rules = [...this.COMMON_RULES, ...this.EXPLAIN_RULES];
        return this.runValidationRules(context, rules);
    }

    /**
     * Validates a query block before execution
     */
    public static validateQueryBlock(
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        metadata?: any,
        connectionOverrides?: ConnectionOverrides
    ): QueryResult | null {
        const context: ValidationContext = {
            query,
            queryType,
            metadata,
            connectionOverrides,
            startTime: Date.now()
        };

        return this.validateQuery(context);
    }

    /**
     * Runs a set of validation rules against a context
     */
    private static runValidationRules(context: ValidationContext, rules: ValidationRule[]): QueryResult | null {
        for (const rule of rules) {
            const result = rule.validate(context);
            if (!result.valid) {
                return {
                    success: false,
                    error: result.error || `Validation failed: ${rule.name}`,
                    executionTime: Date.now() - context.startTime
                };
            }
        }
        return null; // All validations passed
    }

    /**
     * Validates connection overrides
     */
    private static validateConnectionOverrides(context: ValidationContext): ValidationResult {
        if (!context.connectionOverrides) {
            return { valid: true };
        }

        const validation = MarkdownParser.validateConnectionOverrides(context.connectionOverrides);
        return {
            valid: validation.valid,
            error: validation.valid ? undefined : `Connection override error: ${validation.error}`
        };
    }

    /**
     * Validates query syntax and structure
     */
    private static validateQuerySyntax(context: ValidationContext): ValidationResult {
        const validation = MarkdownParser.validateQuery(context.query, context.queryType, context.metadata);
        return {
            valid: validation.valid,
            error: validation.error
        };
    }

    /**
     * Validates API operation metadata
     */
    private static validateApiMetadata(context: ValidationContext): ValidationResult {
        if (context.queryType !== 'opensearch-api') {
            return { valid: true };
        }

        if (!context.metadata?.method || !context.metadata?.endpoint) {
            return {
                valid: false,
                error: 'API operations require method and endpoint metadata'
            };
        }

        // Validate HTTP method
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
        if (!validMethods.includes(context.metadata.method.toUpperCase())) {
            return {
                valid: false,
                error: `Invalid HTTP method: ${context.metadata.method}. Must be one of: ${validMethods.join(', ')}`
            };
        }

        // Validate endpoint format
        if (typeof context.metadata.endpoint !== 'string' || context.metadata.endpoint.trim() === '') {
            return {
                valid: false,
                error: 'API endpoint must be a non-empty string'
            };
        }

        return { valid: true };
    }

    /**
     * Validates explain query type
     */
    private static validateExplainQueryType(context: ValidationContext): ValidationResult {
        if (context.queryType !== 'sql' && context.queryType !== 'ppl') {
            return {
                valid: false,
                error: 'Explain is only supported for SQL and PPL queries'
            };
        }

        return { valid: true };
    }

    /**
     * Validates query content for common issues
     */
    public static validateQueryContent(query: string, queryType: string): ValidationResult {
        if (!query || query.trim() === '') {
            return {
                valid: false,
                error: 'Query cannot be empty'
            };
        }

        // Check for potentially dangerous operations
        const dangerousPatterns = [
            /DROP\s+TABLE/i,
            /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i,
            /TRUNCATE\s+TABLE/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(query)) {
                return {
                    valid: false,
                    error: 'Query contains potentially dangerous operations'
                };
            }
        }

        // Type-specific validations
        if (queryType === 'sql') {
            return this.validateSqlQuery(query);
        } else if (queryType === 'ppl') {
            return this.validatePplQuery(query);
        }

        return { valid: true };
    }

    /**
     * Validates SQL query structure
     */
    private static validateSqlQuery(query: string): ValidationResult {
        const trimmedQuery = query.trim().toUpperCase();
        
        // Check for basic SQL structure
        const sqlKeywords = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'];
        const hasValidStart = sqlKeywords.some(keyword => trimmedQuery.startsWith(keyword));
        
        if (!hasValidStart) {
            return {
                valid: false,
                error: `SQL query must start with one of: ${sqlKeywords.join(', ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Validates PPL query structure
     */
    private static validatePplQuery(query: string): ValidationResult {
        const trimmedQuery = query.trim();
        
        // PPL queries typically start with 'source=' or 'search'
        if (!trimmedQuery.startsWith('source=') && !trimmedQuery.toLowerCase().startsWith('search')) {
            return {
                valid: false,
                error: 'PPL query must start with "source=" or "search"'
            };
        }

        return { valid: true };
    }

    /**
     * Creates a validation context from parameters
     */
    public static createContext(
        query: string,
        queryType: 'sql' | 'ppl' | 'opensearch-api',
        metadata?: any,
        connectionOverrides?: ConnectionOverrides
    ): ValidationContext {
        return {
            query,
            queryType,
            metadata,
            connectionOverrides,
            startTime: Date.now()
        };
    }
}

/**
 * Centralized JSON utility functions
 */
export class JsonUtils {
    /**
     * Checks if a string contains valid JSON
     */
    public static isValidJSON(str: string): boolean {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Parse JSON string safely
     */
    public static parseJSON(str: string): any {
        return JSON.parse(str);
    }
    
    /**
     * Validate and parse JSON with detailed error information
     */
    public static validateAndParse(str: string): { valid: boolean; data?: any; error?: string } {
        try {
            const data = JSON.parse(str);
            return { valid: true, data };
        } catch (error: any) {
            return { valid: false, error: error.message };
        }
    }
    
    /**
     * Validate JSON for bulk operations (NDJSON format)
     */
    public static validateBulkJSON(content: string): { valid: boolean; error?: string } {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) { // Skip empty lines
                if (!this.isValidJSON(trimmedLine)) {
                    return { 
                        valid: false, 
                        error: `Invalid JSON in bulk request line: ${trimmedLine}` 
                    };
                }
            }
        }
        return { valid: true };
    }
    
    /**
     * Format JSON string with proper indentation
     */
    public static formatJSON(str: string, indent: number = 2): string {
        try {
            const parsed = JSON.parse(str);
            return JSON.stringify(parsed, null, indent);
        } catch (error) {
            // If not valid JSON, return as-is
            return str;
        }
    }
}

/**
 * Utility functions for formatting timestamps
 */
export class TimestampFormatter {
    /**
     * Format timestamp in local timezone with ISO-like format
     * @param date The date to format
     * @returns Formatted timestamp string (e.g., "2025-09-15T22:12:37")
     */
    public static formatLocal(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }
}

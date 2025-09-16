/**
 * Centralized SVG icon management for the OpenSearch Query Runner extension
 */
export class SvgIcons {
    /**
     * Get clipboard icon SVG
     * @param width Icon width (default: 16)
     * @param height Icon height (default: 16)
     * @returns SVG string for clipboard icon
     */
    public static getClipboardIcon(width: number = 16, height: number = 16): string {
        return `<svg width="${width}" height="${height}" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
            <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
        </svg>`;
    }

    /**
     * Get trash/delete icon SVG
     * @param width Icon width (default: 16)
     * @param height Icon height (default: 16)
     * @returns SVG string for trash icon
     */
    public static getTrashIcon(width: number = 16, height: number = 16): string {
        return `<svg width="${width}" height="${height}" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>`;
    }

    /**
     * Get history icon (clock with circular arrow border and traditional clock hands)
     * @param width Icon width (default: 16)
     * @param height Icon height (default: 16)
     * @returns SVG string for history icon
     */
    public static getHistoryIcon(width: number = 16, height: number = 16): string {
        return `<svg width="${width}" height="${height}" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
            <path d="M8 5.5a.5.5 0 0 0-.5.5v2.5l1.5 1a.5.5 0 0 0 .6-.8L8.5 7.7V6a.5.5 0 0 0-.5-.5z"/>
            <circle cx="8" cy="8" r="0.5"/>
        </svg>`;
    }

    /**
     * Get all available icons as a map
     * @returns Object containing all available icon functions
     */
    public static getAllIcons() {
        return {
            clipboard: this.getClipboardIcon,
            trash: this.getTrashIcon,
            history: this.getHistoryIcon,
        };
    }
}

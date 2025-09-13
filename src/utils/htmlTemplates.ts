export class HtmlTemplates {
    /**
     * Generate the base HTML structure with common CSS and JavaScript
     */
    public static generateBaseHtml(
        title: string,
        timestamp: string,
        queryType: string,
        query: string,
        content: string,
        hasExplain: boolean = false
    ): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                ${this.getCommonCSS()}
            </style>
        </head>
        <body>
            ${this.generateHeader(timestamp)}
            ${this.generateQueryInfo(queryType, query)}
            ${content}
            <script>
                ${this.getCommonJavaScript()}
            </script>
        </body>
        </html>
        `;
    }

    /**
     * Generate the header section
     */
    private static generateHeader(timestamp: string): string {
        return `
            <div class="header">
                <div class="header-content">
                    <div class="header-left">
                        <h1>OpenSearch Query Results</h1>
                        <p>Executed at ${timestamp}</p>
                    </div>
                    <div class="header-right">
                        <button class="btn history-btn" onclick="showHistory()" title="View Query History">
                            <span class="icon">📋</span>
                            History
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate the query info section
     */
    private static generateQueryInfo(queryType: string, query: string): string {
        return `
            <div class="query-info">
                <div class="query-type-label">${queryType.toUpperCase()}</div>
                <div class="query-content">
                    <pre>${query}</pre>
                </div>
            </div>
        `;
    }

    /**
     * Generate tabs structure
     */
    public static generateTabs(tabs: Array<{ id: string; label: string; active?: boolean }>): string {
        const tabHeaders = tabs.map(tab => 
            `<div class="tab ${tab.active ? 'active' : ''}" onclick="showTab('${tab.id}')">${tab.label}</div>`
        ).join('');

        return `
            <div class="tabs">
                ${tabHeaders}
            </div>
        `;
    }

    /**
     * Generate tab content wrapper
     */
    public static generateTabContent(id: string, content: string, active: boolean = false): string {
        return `
            <div id="${id}" class="tab-content ${active ? 'active' : ''}">
                ${content}
            </div>
        `;
    }

    /**
     * Generate metadata section
     */
    public static generateMetadata(items: Array<{ label: string; type?: 'success' | 'error' }>): string {
        const metadataItems = items.map(item => 
            `<span class="metadata-item ${item.type || ''}">${item.label}</span>`
        ).join('');

        return `
            <div class="metadata">
                ${metadataItems}
            </div>
        `;
    }

    /**
     * Generate JSON container
     */
    public static generateJsonContainer(content: string): string {
        return `
            <div class="json-container">
                <pre>${content}</pre>
            </div>
        `;
    }

    /**
     * Generate debug section
     */
    public static generateDebugSection(items: Array<{ title: string; content: string }>): string {
        const debugItems = items.map(item => `
            <div class="debug-item">
                <h3>${item.title}</h3>
                ${item.content}
            </div>
        `).join('');

        return `
            <div class="debug-section">
                ${debugItems}
            </div>
        `;
    }

    /**
     * Get common CSS styles
     */
    private static getCommonCSS(): string {
        return `
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .header-left h1 {
                    margin: 0 0 5px 0;
                }
                .header-left p {
                    margin: 0;
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .header-right {
                    display: flex;
                    align-items: center;
                }
                .history-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: background-color 0.2s ease;
                }
                .history-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .history-btn .icon {
                    font-size: 1em;
                }
                .query-info {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-button-background);
                    padding: 10px 15px;
                    margin-bottom: 20px;
                    position: relative;
                }
                .query-type-label {
                    position: absolute;
                    top: 0;
                    left: 0;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 4px 8px;
                    font-size: 0.8em;
                    font-weight: bold;
                    text-transform: uppercase;
                    z-index: 1;
                }
                .query-content {
                    margin-top: 20px;
                }
                .success {
                    color: var(--vscode-testing-iconPassed);
                }
                .error {
                    color: var(--vscode-testing-iconFailed);
                }
                .metadata {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 20px;
                    font-size: 0.9em;
                }
                .metadata-item {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 3px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px 12px;
                    text-align: left;
                }
                th {
                    background-color: var(--vscode-list-hoverBackground);
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                }
                .json-container {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    overflow-x: auto;
                }
                pre {
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .tabs {
                    display: flex;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 15px;
                }
                .tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                }
                .tab.active {
                    border-bottom-color: var(--vscode-focusBorder);
                    background-color: var(--vscode-tab-activeBackground);
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
                .debug-section {
                    margin-top: 10px;
                }
                .debug-item {
                    margin-bottom: 20px;
                }
                .debug-item h3 {
                    margin: 0 0 10px 0;
                    color: var(--vscode-foreground);
                    font-size: 1.1em;
                }
        `;
    }

    /**
     * Get common JavaScript
     */
    private static getCommonJavaScript(): string {
        return `
                const vscode = acquireVsCodeApi();

                function showTab(tabName) {
                    // Hide all tab contents
                    const contents = document.querySelectorAll('.tab-content');
                    contents.forEach(content => content.classList.remove('active'));
                    
                    // Remove active class from all tabs
                    const tabs = document.querySelectorAll('.tab');
                    tabs.forEach(tab => tab.classList.remove('active'));
                    
                    // Show selected tab content
                    document.getElementById(tabName).classList.add('active');
                    document.querySelector('[onclick="showTab(\\''+tabName+'\\')"]').classList.add('active');
                }

                function showHistory() {
                    vscode.postMessage({
                        command: 'showHistory'
                    });
                }
        `;
    }
}

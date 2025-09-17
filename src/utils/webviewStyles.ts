/**
 * Shared CSS and JavaScript utilities for webview components
 */
export class WebviewStyles {
    /**
     * Common CSS styles for query results webviews
     */
    public static getCommonCSS(): string {
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
                .btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: background-color 0.2s ease;
                }
                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
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
                .history-section {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 20px;
                    padding: 10px;
                    background-color: var(--vscode-list-inactiveSelectionBackground);
                    border-radius: 4px;
                }
                .history-icon {
                    font-size: 1.2em;
                    color: var(--vscode-foreground);
                    opacity: 0.8;
                }
                .history-squares {
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                }
                .history-square {
                    width: 21px;
                    height: 21px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 3px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 1.0em;
                    color: black !important;
                    transition: all 0.2s ease;
                    border: 2px solid transparent;
                }
                .history-square:hover {
                    opacity: 0.8;
                    transform: scale(1.05);
                }
                .history-square.success {
                    background-color: var(--vscode-testing-iconPassed);
                }
                .history-square.error {
                    background-color: var(--vscode-testing-iconFailed);
                }
                .history-square.selected {
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                }
                .query-info {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-button-background);
                    padding: 10px 15px;
                    margin-bottom: 20px;
                    position: relative;
                }
                .query-type-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    display: flex;
                    align-items: stretch;
                    z-index: 1;
                    max-width: calc(100% - 20px);
                }
                .query-type-label {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 4px 8px;
                    font-size: 0.9em;
                    font-weight: bold;
                    text-transform: uppercase;
                    border-top-right-radius: 3px;
                    border-bottom-right-radius: 3px;
                    border-left: 1px solid rgba(255, 255, 255, 0.2);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    min-width: 0;
                    flex: 1;
                }
                .delete-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 4px 6px;
                    font-size: 1.0em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 20px;
                }
                .delete-btn:hover {
                    background-color: var(--vscode-errorForeground);
                    color: white;
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
                .row-number-header {
                    width: 60px;
                    text-align: center;
                    background-color: var(--vscode-list-hoverBackground);
                    font-weight: bold;
                }
                .row-number {
                    width: 60px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                    background-color: inherit;
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
                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 50px;
                }
                .content-with-conversion {
                    position: relative;
                }
                .conversion-header {
                    position: absolute;
                    top: 0;
                    right: 0;
                    z-index: 10;
                    padding: 8px;
                }
                .convert-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.85em;
                    transition: background-color 0.2s ease;
                }
                .convert-btn:hover:not(.disabled) {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .convert-btn.disabled {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                .format-container {
                }
                .yaml-container {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    overflow-x: auto;
                }
                .copy-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 0.8em;
                    transition: background-color 0.2s ease;
                    margin-left: 8px;
                    opacity: 0.8;
                }
                .copy-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                    opacity: 1;
                }
                .copy-btn.copied {
                    background-color: var(--vscode-testing-iconPassed);
                    color: white;
                }
                .copyable-container {
                    position: relative;
                }
                .copy-header {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    z-index: 10;
                    display: flex;
                    gap: 4px;
                }
                .table-container {
                    position: relative;
                    margin-top: 10px;
                }
                .table-copy-header {
                    position: absolute;
                    top: -35px;
                    right: 0;
                    z-index: 10;
                }
        `;
    }

    /**
     * Common JavaScript for query results webviews
     */
    public static getCommonJavaScript(): string {
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

                function selectHistory(historyId) {
                    vscode.postMessage({
                        command: 'selectHistory',
                        historyId: historyId
                    });
                }

                function deleteCurrentHistory() {
                    const selectedSquare = document.querySelector('.history-square.selected');
                    if (selectedSquare) {
                        const historyId = selectedSquare.getAttribute('onclick').match(/'([^']+)'/)[1];
                        vscode.postMessage({
                            command: 'deleteHistory',
                            historyId: historyId
                        });
                    }
                }

                function toggleFormat(containerId) {
                    const jsonContainer = document.getElementById('json-' + containerId);
                    const yamlContainer = document.getElementById('yaml-' + containerId);
                    const button = document.getElementById('convert-btn-' + containerId);
                    
                    if (!jsonContainer || !yamlContainer || !button) {
                        console.error('Toggle containers not found for ID:', containerId);
                        return;
                    }
                    
                    const isShowingJson = jsonContainer.style.display !== 'none';
                    
                    if (isShowingJson) {
                        // Switch to YAML
                        jsonContainer.style.display = 'none';
                        yamlContainer.style.display = 'block';
                        button.textContent = 'Show JSON';
                    } else {
                        // Switch to JSON
                        jsonContainer.style.display = 'block';
                        yamlContainer.style.display = 'none';
                        button.textContent = 'Convert to YAML';
                    }
                }

                function copyToClipboard(elementId, buttonId) {
                    const element = document.getElementById(elementId);
                    if (!element) {
                        console.error('Element not found:', elementId);
                        return;
                    }
                    
                    let textToCopy = '';
                    
                    // Handle different element types
                    if (element.tagName === 'TABLE') {
                        textToCopy = tableToText(element);
                    } else if (element.tagName === 'PRE' || element.classList.contains('json-container') || element.classList.contains('yaml-container')) {
                        textToCopy = element.textContent || element.innerText;
                    } else {
                        textToCopy = element.textContent || element.innerText;
                    }
                    
                    // Use the Clipboard API if available, otherwise fallback to execCommand
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            showCopySuccess(buttonId);
                        }).catch(err => {
                            console.error('Failed to copy text: ', err);
                            fallbackCopyTextToClipboard(textToCopy, buttonId);
                        });
                    } else {
                        fallbackCopyTextToClipboard(textToCopy, buttonId);
                    }
                }
                
                function copyVisibleContent(containerId, buttonId) {
                    const jsonContainer = document.getElementById('json-' + containerId);
                    const yamlContainer = document.getElementById('yaml-' + containerId);
                    
                    let visibleElement = null;
                    if (jsonContainer && jsonContainer.style.display !== 'none') {
                        visibleElement = jsonContainer.querySelector('pre');
                    } else if (yamlContainer && yamlContainer.style.display !== 'none') {
                        visibleElement = yamlContainer.querySelector('pre');
                    } else if (jsonContainer) {
                        visibleElement = jsonContainer.querySelector('pre');
                    }
                    
                    if (!visibleElement) {
                        console.error('No visible content found for container:', containerId);
                        return;
                    }
                    
                    const textToCopy = visibleElement.textContent || visibleElement.innerText;
                    
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            showCopySuccess(buttonId);
                        }).catch(err => {
                            console.error('Failed to copy text: ', err);
                            fallbackCopyTextToClipboard(textToCopy, buttonId);
                        });
                    } else {
                        fallbackCopyTextToClipboard(textToCopy, buttonId);
                    }
                }
                
                function fallbackCopyTextToClipboard(text, buttonId) {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    
                    try {
                        const successful = document.execCommand('copy');
                        if (successful) {
                            showCopySuccess(buttonId);
                        } else {
                            console.error('Fallback copy failed');
                        }
                    } catch (err) {
                        console.error('Fallback copy failed: ', err);
                    }
                    
                    document.body.removeChild(textArea);
                }
                
                function showCopySuccess(buttonId) {
                    const button = document.getElementById(buttonId);
                    if (button) {
                        const originalText = button.textContent;
                        button.textContent = 'Copied!';
                        button.classList.add('copied');
                        
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.classList.remove('copied');
                        }, 2000);
                    }
                }
                
                function tableToText(table) {
                    let text = '';
                    const rows = table.querySelectorAll('tr');
                    
                    rows.forEach((row, rowIndex) => {
                        const cells = row.querySelectorAll('th, td');
                        const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
                        text += cellTexts.join('\\t') + '\\n';
                    });
                    
                    return text;
                }

                // Initialize all conversion buttons on page load
                document.addEventListener('DOMContentLoaded', function() {
                    // Find all conversion buttons and ensure they're properly initialized
                    const convertButtons = document.querySelectorAll('.convert-btn:not(.disabled)');
                    convertButtons.forEach(button => {
                        // Ensure button text is correct on load
                        if (button.textContent.trim() === '') {
                            button.textContent = 'Convert to YAML';
                        }
                    });
                });
        `;
    }
}

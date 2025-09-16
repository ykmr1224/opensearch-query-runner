import * as yaml from 'js-yaml';

export class YamlConverter {
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
     * Converts JSON string to YAML with compact formatting
     */
    public static convertJsonToYaml(jsonString: string): string {
        try {
            const jsonObj = JSON.parse(jsonString);
            return yaml.dump(jsonObj, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false,
                flowLevel: -1,
                styles: {
                    '!!null': 'canonical' // Display null as ~
                }
            });
        } catch (error) {
            throw new Error(`Failed to convert JSON to YAML: ${error}`);
        }
    }

    /**
     * Generates a unique ID for content containers
     */
    public static generateContentId(): string {
        return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Creates HTML structure for JSON/YAML toggle display
     */
    public static createToggleContainer(jsonContent: string, containerId: string, skipEscaping: boolean = false): string {
        let yamlContent = '';
        let hasValidJson = false;

        if (this.isValidJSON(jsonContent)) {
            try {
                yamlContent = this.convertJsonToYaml(jsonContent);
                hasValidJson = true;
            } catch {
                // If conversion fails, disable the button
                hasValidJson = false;
            }
        }

        const buttonDisabled = hasValidJson ? '' : 'disabled';
        const buttonClass = hasValidJson ? 'convert-btn' : 'convert-btn disabled';

        // For JSON content that's already safe (like JSON.stringify output), we can skip escaping
        const jsonDisplay = skipEscaping ? jsonContent : this.escapeHtml(jsonContent);
        const yamlDisplay = skipEscaping ? yamlContent : this.escapeHtml(yamlContent);

        return `
            <div class="content-with-conversion">
                <div class="conversion-header">
                    <button id="copy-btn-${containerId}" 
                            class="copy-btn" 
                            onclick="copyVisibleContent('${containerId}', 'copy-btn-${containerId}')">
                        Copy
                    </button>
                    <button id="convert-btn-${containerId}" 
                            class="${buttonClass}" 
                            onclick="toggleFormat('${containerId}')" 
                            ${buttonDisabled}>
                        Convert to YAML
                    </button>
                </div>
                <div id="json-${containerId}" class="format-container json-container">
                    <pre>${jsonDisplay}</pre>
                </div>
                <div id="yaml-${containerId}" class="format-container yaml-container" style="display: none;">
                    <pre>${yamlDisplay}</pre>
                </div>
            </div>
        `;
    }

    /**
     * Escapes HTML characters to prevent XSS
     */
    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

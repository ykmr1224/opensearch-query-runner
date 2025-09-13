import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // Get theme parameter from command line arguments
        const theme = process.argv[2] || 'dark';
        const validThemes = ['dark', 'light'];
        
        if (!validThemes.includes(theme)) {
            console.error(`Invalid theme: ${theme}. Valid themes are: ${validThemes.join(', ')}`);
            process.exit(1);
        }

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the manual test entry point
        // This will open demo.md and keep VSCode open
        const extensionTestsPath = path.resolve(__dirname, './manualTestEntry');

        // Choose workspace file based on theme
        const workspaceFile = theme === 'light' 
            ? 'opensearch-query-runner-light.code-workspace'
            : 'opensearch-query-runner.code-workspace';

        const themeDescription = theme === 'light' ? 'Light Purple' : 'Dark Purple';

        console.log(`Starting manual test environment (${themeDescription} Theme)...`);
        console.log('Extension path:', extensionDevelopmentPath);
        console.log(`This will open VSCode with ${theme} purple theme and demo.md for manual testing.`);
        console.log('Close the VSCode window when you\'re done testing.');

        // Download VS Code, unzip it and run the manual test environment
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath,
            // Keep the window open - don't exit after "tests" complete
            launchArgs: [
                '--disable-extensions', // Disable other extensions for clean testing
                path.resolve(extensionDevelopmentPath, workspaceFile) // Open appropriate workspace file
            ]
        });
    } catch (err) {
        console.error('Failed to start manual test environment:', err);
        process.exit(1);
    }
}

main();

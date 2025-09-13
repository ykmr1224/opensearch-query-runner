import * as vscode from 'vscode';
import * as path from 'path';

export function run(): Promise<void> {
    return new Promise(async (resolve) => {
        console.log('Manual test environment started');
        console.log('Opening demo.md for manual testing...');

        try {
            // Wait a moment for VSCode to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get the workspace root (extension directory)
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            if (workspaceRoot) {
                // Path to demo.md
                const demoPath = path.join(workspaceRoot, 'demo.md');
                const demoUri = vscode.Uri.file(demoPath);

                // Open demo.md
                const document = await vscode.workspace.openTextDocument(demoUri);
                await vscode.window.showTextDocument(document, {
                    preview: false, // Open in a regular tab, not preview
                    viewColumn: vscode.ViewColumn.One
                });

                console.log('demo.md opened successfully!');
            } else {
                console.log('No workspace found, but demo.md should be opened via launch args');
            }

            console.log('You can now manually test the extension features:');
            console.log('- Try running SQL queries with CodeLens buttons');
            console.log('- Test PPL queries');
            console.log('- Try OpenSearch REST API calls');
            console.log('- Test configuration blocks');
            console.log('- Check query history functionality');
            console.log('The extension is fully loaded and ready for testing.');
            console.log('Close this VSCode window when you\'re done testing.');

        } catch (error) {
            console.log('Could not open demo.md automatically:', error);
            console.log('You can manually open demo.md from the file explorer.');
            console.log('The extension is still fully loaded and ready for testing.');
        }

        // Keep the "test" running indefinitely
        // This prevents VSCode from closing automatically
        // The user will manually close VSCode when done testing
        console.log('Manual test environment is ready. Window will stay open for manual testing.');
        
        // Never resolve this promise - keeps VSCode open
        // The user will close VSCode manually when done
    });
}

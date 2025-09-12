# VSCode Extension Development Instructions

## Extension Reload Requirements

When developing VSCode extensions, code changes require the extension to be reloaded to take effect:

1. **After code changes**: The extension must be reloaded or reinstalled
2. **Simple reload may not work**: Sometimes a full uninstall/reinstall is required
3. **Testing workflow**: 
   - Make code changes
   - Build the extension (`npm run compile` or `npm run package`)
   - Uninstall the current version
   - Install the new version
   - Test the changes

## Common Issues

- Extension behavior doesn't change after code modifications → Need to reload/reinstall
- Old code still executing → Extension cache issue, requires full reinstall
- API changes not taking effect → Extension runtime needs refresh

## Best Practices

- Always test extension changes in a fresh VSCode window after reinstall
- Use `Developer: Reload Window` command when possible
- For major changes, prefer uninstall/reinstall workflow
- Keep track of extension version numbers to ensure correct version is loaded

## Development Scripts

The project includes convenient npm scripts for development:

- `npm run reinstall` - Packages, uninstalls, and reinstalls the extension in one command
- `npm run dev` - Compiles and reinstalls the extension (same as reinstall but shorter)
- `npm run package` - Only packages the extension without installing
- `npm run compile` - Only compiles TypeScript without packaging

**Recommended development workflow:**
1. Make code changes
2. Run `npm run reinstall` (or `npm run dev`)
3. Test the changes in VSCode
4. Repeat as needed

## Notes Directory

The `notes/` directory is used for development notes and documentation that should not be committed to version control. This includes:

- Bug fix documentation
- Development notes
- Investigation findings
- Temporary documentation

The `notes/` directory is excluded from git via `.gitignore`.

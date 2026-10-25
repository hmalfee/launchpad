# Launchpad

Build your own buttons for VS Code, from a visual manager. Nothing is built in: every launcher is one you create.

Open the manager with **Launchpad: Open Manager** (command palette) or the gear in the Launchpad sidebar.

## What a launcher can do
- **Terminal**: one or more commands, working directory, reuse/re-run/new terminal, panel or editor area, optional confirm.
- **VS Code command**: any command id (searchable), optional JSON arguments.
- **Open URL** / **Open file**.

Variables work in every field: `${file}` `${relativeFile}` `${fileBasename}` `${fileDirname}` `${workspaceFolder}`
`${selectedText}` `${lineNumber}` `${clipboard}` `${env:NAME}` `${prompt:Question}`.

## Where it can appear
| Place | Dynamic? | Notes |
|---|---|---|
| Status bar | Instantly | Side, priority, color, warning/error highlight, icon-only. |
| Sidebar (Activity Bar) | Instantly | One "Launchpad" view, optional folders. |
| Editor title bar | After a window reload | VS Code only reads these from package.json at window load. Launchpad rewrites its own installed package.json and prompts you to reload. |
| Command palette | Instantly | **Launchpad: Run Launcher…** lists everything. |
| Keyboard shortcut | Instantly | "Copy keybinding snippet" in the editor gives you a ready-made entry. |

## Global vs project
Stored in the `launchpad.items` setting: user settings = global, workspace settings (`.vscode/settings.json`) = project.
Commit `.vscode/settings.json` to share project launchers with your team.

## Build and install
```
pnpm install
pnpm build        # extension (tsdown) + webview UI (vite)
./install.sh      # copies into ~/.vscode/extensions
```
`pnpm typecheck` checks both halves. `pnpm dev:webview` rebuilds the UI on change.
Title bar sync is skipped in the Extension Development Host (F5) so it never edits your source package.json.

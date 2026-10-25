import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { runItem } from './runner';
import { findById, hasWorkspace, readScope, writeScope } from './store';
import type { Intent, StatePayload, ToExtension, ToWebview } from './types';

/** The visual manager: a webview running the React + shadcn UI from dist/webview. */
export class ManagerPanel {
    private static current: ManagerPanel | undefined;

    private ready = false;
    private pending: Intent | undefined;
    private readonly disposables: vscode.Disposable[] = [];

    static show(context: vscode.ExtensionContext, intent?: Intent): void {
        if (ManagerPanel.current) {
            ManagerPanel.current.panel.reveal(undefined, false);
            ManagerPanel.current.deliver(intent);
            return;
        }
        ManagerPanel.current = new ManagerPanel(context, intent);
    }

    static refresh(): void {
        ManagerPanel.current?.postState();
    }

    private readonly panel: vscode.WebviewPanel;

    private constructor(
        private readonly context: vscode.ExtensionContext,
        intent?: Intent,
    ) {
        const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
        this.pending = intent;
        this.panel = vscode.window.createWebviewPanel('launchpad.manager', 'Launchpad', vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [root],
        });
        this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'activity.svg');
        this.panel.webview.html = this.html(root);

        this.panel.webview.onDidReceiveMessage((m: ToExtension) => void this.onMessage(m), null, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private html(root: vscode.Uri): string {
        const webview = this.panel.webview;
        const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(root, 'assets', name));
        const nonce = randomBytes(16).toString('base64');
        const csp = [
            `default-src 'none'`,
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `font-src ${webview.cspSource} data:`,
            `img-src ${webview.cspSource} data: https:`,
            `script-src 'nonce-${nonce}'`,
        ].join('; ');

        return /* html */ `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${asset('index.css')}" />
    <title>Launchpad</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${asset('index.js')}"></script>
</body>
</html>`;
    }

    private post(message: ToWebview): void {
        void this.panel.webview.postMessage(message);
    }

    private deliver(intent?: Intent): void {
        if (!intent) return;
        if (this.ready) this.post({ type: 'intent', intent });
        else this.pending = intent;
    }

    postState(): void {
        if (!this.ready) return;
        const state: StatePayload = {
            global: readScope('global'),
            workspace: readScope('workspace'),
            hasWorkspace: hasWorkspace(),
            workspaceName: vscode.workspace.name ?? '',
        };
        this.post({ type: 'state', state });
    }

    private async onMessage(m: ToExtension): Promise<void> {
        switch (m.type) {
            case 'ready':
                this.ready = true;
                this.postState();
                if (this.pending) {
                    this.post({ type: 'intent', intent: this.pending });
                    this.pending = undefined;
                }
                return;

            case 'save':
                await writeScope(m.scope, m.items);
                return;

            case 'run': {
                const r = findById(m.scope, m.id);
                if (r) await runItem(r);
                return;
            }

            case 'copyKeybinding': {
                const r = findById(m.scope, m.id);
                if (!r) return;
                const snippet = JSON.stringify({ key: '', command: 'launchpad.runItem', args: r.key }, null, 4);
                await vscode.env.clipboard.writeText(snippet);
                const open = 'Open keybindings.json';
                const choice = await vscode.window.showInformationMessage(
                    'Keybinding snippet copied. Paste it into keybindings.json and fill in a key.',
                    open,
                );
                if (choice === open) await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');
                return;
            }

            case 'openJson':
                await vscode.commands.executeCommand(
                    m.scope === 'global' ? 'workbench.action.openSettingsJson' : 'workbench.action.openWorkspaceSettingsFile',
                );
                return;

            case 'pickFile': {
                const root = vscode.workspace.workspaceFolders?.[0]?.uri;
                const [picked] =
                    (await vscode.window.showOpenDialog({ canSelectMany: false, defaultUri: root })) ?? [];
                let value: string | null = null;
                if (picked) {
                    const rel = root ? path.relative(root.fsPath, picked.fsPath) : '';
                    value = rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : picked.fsPath;
                }
                this.post({ type: 'picked', requestId: m.requestId, value });
                return;
            }

            case 'requestCommands':
                this.post({ type: 'commands', list: (await vscode.commands.getCommands(true)).sort() });
                return;
        }
    }

    private dispose(): void {
        ManagerPanel.current = undefined;
        this.panel.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
}


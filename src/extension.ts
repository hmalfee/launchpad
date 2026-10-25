import * as vscode from 'vscode';
import { ManagerPanel } from './manager';
import { runItem } from './runner';
import { SidebarProvider, type SidebarNode } from './sidebar';
import { StatusBarController } from './statusBar';
import { findById, findByKey, resolveAll } from './store';
import { TitleBarController } from './titleBar';
import { type Intent, defaultIcon, summarizeAction } from './types';

export function activate(context: vscode.ExtensionContext): void {
    const statusBar = new StatusBarController();
    const sidebar = new SidebarProvider();
    const titleBar = new TitleBarController(context);

    const refresh = () => {
        const all = resolveAll();
        statusBar.sync(all);
        sidebar.refresh(all);
        titleBar.sync(all);
        ManagerPanel.refresh();
    };

    const keyFrom = (arg: unknown): string | undefined => {
        if (typeof arg === 'string') return arg;
        const node = arg as SidebarNode | undefined;
        return node?.kind === 'item' ? node.resolved.key : undefined;
    };
    const open = (intent?: Intent) => ManagerPanel.show(context, intent);

    context.subscriptions.push(
        statusBar,
        titleBar,
        vscode.window.registerTreeDataProvider('launchpad.sidebar', sidebar),

        vscode.commands.registerCommand('launchpad.openManager', () => open()),
        vscode.commands.registerCommand('launchpad.newLauncher', () => open({ kind: 'new' })),

        vscode.commands.registerCommand('launchpad.runItem', async (arg: unknown) => {
            const key = keyFrom(arg);
            const found = key ? findByKey(key) : undefined;
            if (found) await runItem(found);
            else void vscode.window.showWarningMessage('Launchpad: that launcher no longer exists.');
        }),

        vscode.commands.registerCommand('launchpad.editItem', (arg: unknown) => {
            const key = keyFrom(arg);
            const found = key ? findByKey(key) : undefined;
            if (found) open({ kind: 'edit', scope: found.scope, id: found.item.id });
        }),

        vscode.commands.registerCommand('launchpad.run', async () => {
            const all = resolveAll().filter((r) => r.item.enabled);
            if (!all.length) {
                const create = 'Create a launcher';
                const choice = await vscode.window.showInformationMessage('You have no launchers yet.', create);
                if (choice) open({ kind: 'new' });
                return;
            }
            const picked = await vscode.window.showQuickPick(
                all.map((r) => ({
                    label: `$(${r.item.icon || defaultIcon(r.item)}) ${r.item.label}`,
                    description: r.scope === 'workspace' ? 'project' : 'global',
                    detail: summarizeAction(r.item.action),
                    resolved: r,
                })),
                { placeHolder: 'Run a launcher', matchOnDetail: true },
            );
            if (picked) await runItem(findById(picked.resolved.scope, picked.resolved.item.id) ?? picked.resolved);
        }),

        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('launchpad')) refresh();
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    );

    refresh();
}

export function deactivate(): void {}

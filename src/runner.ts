import * as vscode from 'vscode';
import type { Resolved } from './store';
import type { CommandAction, FileAction, LauncherItem, TerminalAction, UrlAction } from './types';
import { Cancelled, expandPath, resolveVars, workspaceRoot } from './variables';

export async function runItem({ item }: Resolved, locationOverride?: 'panel' | 'editor'): Promise<void> {
    try {
        switch (item.action.type) {
            case 'terminal':
                return await runTerminal(item, item.action, locationOverride);
            case 'command':
                return await runCommand(item.action);
            case 'url':
                return await runUrl(item.action);
            case 'file':
                return await runFile(item.action);
        }
    } catch (err) {
        if (err instanceof Cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Launchpad: “${item.label}” failed. ${message}`);
    }
}

async function runTerminal(
    item: LauncherItem,
    a: TerminalAction,
    locationOverride?: 'panel' | 'editor',
): Promise<void> {
    const location = locationOverride ?? a.location;
    const existing = vscode.window.terminals.find(
        (t) =>
            t.name === item.label &&
            t.exitStatus === undefined &&
            (location === 'editor'
                ? t.creationOptions.location instanceof Object &&
                  'viewColumn' in (t.creationOptions.location as object)
                : !(
                      t.creationOptions.location instanceof Object &&
                      'viewColumn' in (t.creationOptions.location as object)
                  )),
    );
    if (existing && a.onExisting === 'focus') {
        existing.show();
        return;
    }

    const lines = (await resolveVars(a.command))
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (!lines.length) throw new Error('This launcher has no command to run.');

    if (a.confirm) {
        const choice = await vscode.window.showWarningMessage(
            `Run “${item.label}”?`,
            { modal: true, detail: lines.join('\n') },
            'Run',
        );
        if (choice !== 'Run') return;
    }

    let terminal = existing && a.onExisting === 'rerun' ? existing : undefined;
    if (!terminal) {
        const cwd = a.cwd ? expandPath(await resolveVars(a.cwd)) : workspaceRoot();
        terminal = vscode.window.createTerminal({
            name: item.label,
            cwd,
            location: location === 'editor' ? { viewColumn: vscode.ViewColumn.Active } : undefined,
        });
    }
    terminal.show();
    for (const line of lines) terminal.sendText(line);
}

async function runCommand(a: CommandAction): Promise<void> {
    const id = a.commandId.trim();
    if (!id) throw new Error('This launcher has no command id.');

    let args: unknown[] = [];
    if (a.args.trim()) {
        const text = await resolveVars(a.args);
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error('Arguments are not valid JSON.');
        }
        args = Array.isArray(parsed) ? parsed : [parsed];
    }
    await vscode.commands.executeCommand(id, ...args);
}

async function runUrl(a: UrlAction): Promise<void> {
    let url = (await resolveVars(a.url)).trim();
    if (!url) throw new Error('This launcher has no URL.');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
}

async function runFile(a: FileAction): Promise<void> {
    const p = (await resolveVars(a.path)).trim();
    if (!p) throw new Error('This launcher has no file path.');
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(expandPath(p)));
}

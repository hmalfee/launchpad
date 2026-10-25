import * as vscode from 'vscode';
import { type LauncherItem, type Scope, normalizeItem, prune } from './types';

const SECTION = 'launchpad';
const KEY = 'items';

export interface Resolved {
    /** Unique across scopes and across projects. */
    key: string;
    scope: Scope;
    item: LauncherItem;
}

function hash(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

export function hasWorkspace(): boolean {
    return Boolean(vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile);
}

/** Stable short id for the current project, or undefined when no folder is open. */
export function workspaceId(): string | undefined {
    const uri = vscode.workspace.workspaceFile ?? vscode.workspace.workspaceFolders?.[0]?.uri;
    return uri ? hash(uri.toString()) : undefined;
}

export function readScope(scope: Scope): LauncherItem[] {
    const inspected = vscode.workspace.getConfiguration(SECTION).inspect<unknown[]>(KEY);
    const raw = scope === 'global' ? inspected?.globalValue : inspected?.workspaceValue;
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeItem).filter((i): i is LauncherItem => i !== null);
}

export async function writeScope(scope: Scope, items: LauncherItem[]): Promise<void> {
    if (scope === 'workspace' && !hasWorkspace()) {
        void vscode.window.showWarningMessage('Open a folder to create project launchers.');
        return;
    }
    const target =
        scope === 'global' ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace;
    await vscode.workspace
        .getConfiguration(SECTION)
        .update(KEY, items.length ? items.map(prune) : undefined, target);
}

export function resolveAll(): Resolved[] {
    const wsId = workspaceId();
    const global = readScope('global').map<Resolved>((item) => ({ key: `g.${item.id}`, scope: 'global', item }));
    const workspace = wsId
        ? readScope('workspace').map<Resolved>((item) => ({ key: `w${wsId}.${item.id}`, scope: 'workspace', item }))
        : [];
    return [...global, ...workspace];
}

export function findByKey(key: string): Resolved | undefined {
    return resolveAll().find((r) => r.key === key);
}

export function findById(scope: Scope, id: string): Resolved | undefined {
    return resolveAll().find((r) => r.scope === scope && r.item.id === id);
}

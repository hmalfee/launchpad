import * as vscode from 'vscode';
import type { Resolved } from './store';
import { defaultIcon, summarizeAction } from './types';

type Node = { kind: 'item'; resolved: Resolved } | { kind: 'group'; name: string; children: Resolved[] };

export class SidebarProvider implements vscode.TreeDataProvider<Node> {
    private readonly emitter = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this.emitter.event;
    private visible: Resolved[] = [];

    refresh(all: Resolved[]): void {
        this.visible = all.filter((r) => r.item.enabled && r.item.placements.includes('sidebar'));
        this.emitter.fire();
    }

    getChildren(node?: Node): Node[] {
        if (node?.kind === 'group') return node.children.map((resolved) => ({ kind: 'item', resolved }));
        if (node) return [];

        const top = this.visible.filter((r) => !r.item.group.trim());
        const groups = new Map<string, Resolved[]>();
        for (const r of this.visible) {
            const name = r.item.group.trim();
            if (!name) continue;
            groups.set(name, [...(groups.get(name) ?? []), r]);
        }
        return [
            ...top.map<Node>((resolved) => ({ kind: 'item', resolved })),
            ...[...groups].map<Node>(([name, children]) => ({ kind: 'group', name, children })),
        ];
    }

    getTreeItem(node: Node): vscode.TreeItem {
        if (node.kind === 'group') {
            const g = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded);
            g.iconPath = new vscode.ThemeIcon('folder');
            g.contextValue = 'group';
            return g;
        }
        const { key, scope, item } = node.resolved;
        const t = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.None);
        t.id = key;
        t.iconPath = new vscode.ThemeIcon(item.icon || defaultIcon(item));
        t.description = scope === 'workspace' ? 'project' : undefined;
        t.tooltip = item.description || summarizeAction(item.action);
        t.contextValue = 'launcher';
        t.command = { command: 'launchpad.runItem', title: 'Run', arguments: [key] };
        return t;
    }
}

export type SidebarNode = Node;

import * as vscode from 'vscode';
import type { Resolved } from './store';
import { defaultIcon, summarizeAction } from './types';

export class StatusBarController implements vscode.Disposable {
    private bars: vscode.StatusBarItem[] = [];

    /** Items are recreated on every sync because alignment and priority are fixed at creation. */
    sync(all: Resolved[]): void {
        this.clear();
        for (const { key, item } of all) {
            if (!item.enabled || !item.placements.includes('statusBar')) continue;
            const o = item.statusBar;

            const bar = vscode.window.createStatusBarItem(
                `launchpad.${key}`,
                o.alignment === 'right' ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left,
                o.priority,
            );
            bar.name = `Launchpad: ${item.label}`;

            const icon = item.icon || (o.showLabel ? '' : defaultIcon(item));
            const glyph = icon ? `$(${icon})` : '';
            bar.text = o.showLabel || !glyph ? [glyph, item.label].filter(Boolean).join(' ') : glyph;
            bar.tooltip = item.description || `${item.label}: ${summarizeAction(item.action)}`;

            if (o.color) bar.color = o.color.includes('.') ? new vscode.ThemeColor(o.color) : o.color;
            if (o.background !== 'none') {
                bar.backgroundColor = new vscode.ThemeColor(
                    o.background === 'error' ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground',
                );
            }
            bar.command = { command: 'launchpad.runItem', title: item.label, arguments: [key] };
            bar.show();
            this.bars.push(bar);
        }
    }

    private clear(): void {
        this.bars.forEach((b) => b.dispose());
        this.bars = [];
    }

    dispose(): void {
        this.clear();
    }
}

import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { runItem } from './runner';
import { type Resolved, workspaceId } from './store';
import { defaultIcon, isImageIcon } from './types';

/**
 * VS Code only reads editor title buttons from package.json, and only at window load.
 * To make them user-defined we keep a registry of every title-bar launcher (all projects),
 * write the matching `contributes` entries into our own installed package.json, and ask
 * for a window reload when that changed. Each button is shown only in the project that
 * owns it, through a per-window context key.
 */

interface Entry {
    command: string;
    ctx: string;
    title: string;
    icon: string | { light: string; dark: string };
}
type Registry = Record<string, Entry[]>;

const PREFIX = 'launchpad.t.';
const REGISTRY_KEY = 'launchpad.titleRegistry';
const MANIFEST_HASH_KEY = 'launchpad.titleManifestHash';

const toEntry = ({ key, item }: Resolved): Entry => {
    const raw = item.icon || defaultIcon(item);
    return {
        command: `${PREFIX}${key}`,
        ctx: `launchpad.on.${key}`,
        title: item.label,
        icon: isImageIcon(raw) ? { light: raw, dark: raw } : `$(${raw})`,
    };
};

/** Downloads url to dist/icon-cache/<hash>.<ext> and returns the relative path. */
async function cacheIcon(url: string, extensionPath: string): Promise<string | undefined> {
    const ext = url.split('?')[0].match(/\.(svg|png|jpe?g|gif|webp)$/i)?.[0] ?? '.svg';
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
    const rel = `dist/icon-cache/${hash}${ext}`;
    const dest = path.join(extensionPath, rel);

    try {
        await fs.access(dest);
        return rel;
    } catch {
        /* not cached yet */
    }

    try {
        const res = await fetch(url);
        if (!res.ok) return undefined;
        const buf = Buffer.from(await res.arrayBuffer());
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, buf);
        return rel;
    } catch {
        return undefined;
    }
}

export class TitleBarController implements vscode.Disposable {
    private handlers: vscode.Disposable[] = [];
    private activeContexts = new Set<string>();
    private timer: NodeJS.Timeout | undefined;
    private prompting = false;

    constructor(private readonly context: vscode.ExtensionContext) {}

    sync(all: Resolved[]): void {
        const mine = all.filter((r) => r.item.enabled && r.item.placements.includes('editorTitle'));

        this.handlers.forEach((d) => d.dispose());
        this.handlers = [];
        const next = new Set<string>();
        for (const r of mine) {
            const e = toEntry(r);
            this.handlers.push(vscode.commands.registerCommand(e.command, () => runItem(r, 'editor')));
            void vscode.commands.executeCommand('setContext', e.ctx, true);
            next.add(e.ctx);
        }
        for (const ctx of this.activeContexts) {
            if (!next.has(ctx)) void vscode.commands.executeCommand('setContext', ctx, false);
        }
        this.activeContexts = next;

        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.writeManifest(mine), 800);
    }

    private async writeManifest(mine: Resolved[]): Promise<void> {
        const wsId = workspaceId();
        const registry: Registry = { ...this.context.globalState.get<Registry>(REGISTRY_KEY, {}) };
        registry.global = mine.filter((r) => r.scope === 'global').map(toEntry);
        if (wsId) registry[wsId] = mine.filter((r) => r.scope === 'workspace').map(toEntry);
        await this.context.globalState.update(REGISTRY_KEY, registry);

        // In the Extension Development Host package.json is the source file; leave it alone.
        if (this.context.extensionMode !== vscode.ExtensionMode.Production) return;

        const file = path.join(this.context.extensionPath, 'package.json');
        let pkgText: string;
        try {
            pkgText = await fs.readFile(file, 'utf8');
        } catch {
            return;
        }

        const pkg = JSON.parse(pkgText);
        const entries = Object.values(registry).flat();
        const keep = <T extends { command: string }>(list: T[] = []) =>
            list.filter((x) => !x.command.startsWith(PREFIX));

        const resolvedEntries = await Promise.all(
            entries.map(async (e) => {
                if (typeof e.icon !== 'string') {
                    const local = await cacheIcon(e.icon.light, this.context.extensionPath);
                    return {
                        ...e,
                        icon: local ? { light: local, dark: local } : '$(extensions)',
                    };
                }
                return e;
            }),
        );

        pkg.contributes ??= {};
        pkg.contributes.menus ??= {};
        const menus = pkg.contributes.menus;

        pkg.contributes.commands = [
            ...keep(pkg.contributes.commands),
            ...resolvedEntries.map((e) => ({ command: e.command, title: e.title, category: 'Launchpad', icon: e.icon })),
        ];
        menus['editor/title'] = [
            ...keep(menus['editor/title']),
            ...resolvedEntries.map((e, i) => ({ command: e.command, when: e.ctx, group: `navigation@${i + 1}` })),
        ];
        menus.commandPalette = [
            ...keep(menus.commandPalette),
            ...entries.map((e) => ({ command: e.command, when: 'false' })),
        ];

        const after = JSON.stringify(pkg, null, 4) + '\n';
        const hash = createHash('sha256').update(after).digest('hex').slice(0, 16);
        if (hash === this.context.globalState.get<string>(MANIFEST_HASH_KEY)) return;

        try {
            await fs.writeFile(file, after);
            await this.context.globalState.update(MANIFEST_HASH_KEY, hash);
        } catch (err) {
            void vscode.window.showWarningMessage(
                `Launchpad could not update title bar buttons: ${err instanceof Error ? err.message : err}`,
            );
            return;
        }
        this.promptReload(mine.length);
    }

    private promptReload(count: number): void {
        if (this.prompting) return;
        this.prompting = true;
        const detail = count ? 'Title bar buttons changed.' : 'Title bar buttons were removed.';
        void vscode.window
            .showInformationMessage(`Launchpad: ${detail} Reload the window to apply.`, 'Reload Window')
            .then((choice) => {
                this.prompting = false;
                if (choice) void vscode.commands.executeCommand('workbench.action.reloadWindow');
            });
    }

    dispose(): void {
        clearTimeout(this.timer);
        this.handlers.forEach((d) => d.dispose());
    }
}


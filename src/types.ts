/**
 * Pure types and helpers shared by the extension host and the webview UI.
 * Must not import `vscode`.
 */

export type Scope = 'global' | 'workspace';
export type Placement = 'statusBar' | 'sidebar' | 'editorTitle';
export type ActionType = 'terminal' | 'command' | 'url' | 'file';

export interface TerminalAction {
    type: 'terminal';
    /** One command per line; each line is sent to the terminal in order. */
    command: string;
    /** Relative paths resolve against the workspace root. */
    cwd: string;
    /** What to do when a terminal with this launcher's name is already open. */
    onExisting: 'focus' | 'rerun' | 'new';
    location: 'panel' | 'editor';
    confirm: boolean;
}
export interface CommandAction {
    type: 'command';
    commandId: string;
    /** JSON. An array is spread into arguments, anything else is passed as one argument. */
    args: string;
}
export interface UrlAction {
    type: 'url';
    url: string;
}
export interface FileAction {
    type: 'file';
    path: string;
}
export type Action = TerminalAction | CommandAction | UrlAction | FileAction;

export interface StatusBarOptions {
    alignment: 'left' | 'right';
    priority: number;
    showLabel: boolean;
    /** Hex color or a theme color id such as "terminal.ansiGreen". */
    color: string;
    background: 'none' | 'warning' | 'error';
}

export interface LauncherItem {
    id: string;
    label: string;
    /** Codicon name without the $() wrapper, e.g. "rocket". */
    icon: string;
    description: string;
    /** Sidebar folder. Empty means top level. */
    group: string;
    enabled: boolean;
    placements: Placement[];
    statusBar: StatusBarOptions;
    action: Action;
}

/* ---------- webview <-> extension protocol ---------- */

export interface StatePayload {
    global: LauncherItem[];
    workspace: LauncherItem[];
    hasWorkspace: boolean;
    workspaceName: string;
}
export type Intent = { kind: 'new' } | { kind: 'edit'; scope: Scope; id: string };

export type ToExtension =
    | { type: 'ready' }
    | { type: 'save'; scope: Scope; items: LauncherItem[] }
    | { type: 'run'; scope: Scope; id: string }
    | { type: 'copyKeybinding'; scope: Scope; id: string }
    | { type: 'openJson'; scope: Scope }
    | { type: 'pickFile'; requestId: string }
    | { type: 'requestCommands' };

export type ToWebview =
    | { type: 'state'; state: StatePayload }
    | { type: 'intent'; intent: Intent }
    | { type: 'commands'; list: string[] }
    | { type: 'picked'; requestId: string; value: string | null };

/* ---------- helpers ---------- */

export const PLACEMENT_LABELS: Record<Placement, string> = {
    statusBar: 'Status bar',
    sidebar: 'Sidebar',
    editorTitle: 'Title bar',
};

export const ACTION_LABELS: Record<ActionType, string> = {
    terminal: 'Terminal',
    command: 'VS Code command',
    url: 'Open URL',
    file: 'Open file',
};

export function newId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function defaultAction(type: ActionType): Action {
    switch (type) {
        case 'command':
            return { type, commandId: '', args: '' };
        case 'url':
            return { type, url: '' };
        case 'file':
            return { type, path: '' };
        default:
            return { type: 'terminal', command: '', cwd: '', onExisting: 'focus', location: 'panel', confirm: false };
    }
}

export function defaultStatusBar(): StatusBarOptions {
    return { alignment: 'left', priority: 100, showLabel: true, color: '', background: 'none' };
}

export function createItem(type: ActionType = 'terminal'): LauncherItem {
    return {
        id: newId(),
        label: '',
        icon: '',
        description: '',
        group: '',
        enabled: true,
        placements: ['statusBar', 'sidebar'],
        statusBar: defaultStatusBar(),
        action: defaultAction(type),
    };
}

export function defaultIcon(item: Pick<LauncherItem, 'action'>): string {
    switch (item.action.type) {
        case 'command':
            return 'symbol-event';
        case 'url':
            return 'globe';
        case 'file':
            return 'file';
        default:
            return 'terminal';
    }
}

export function summarizeAction(a: Action): string {
    switch (a.type) {
        case 'terminal': {
            const lines = a.command.split('\n').map((l) => l.trim()).filter(Boolean);
            if (!lines.length) return '(no command)';
            return lines.length > 1 ? `${lines[0]}  (+${lines.length - 1} more)` : lines[0];
        }
        case 'command':
            return a.commandId || '(no command id)';
        case 'url':
            return a.url || '(no url)';
        case 'file':
            return a.path || '(no file)';
    }
}

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, options: readonly T[], d: T): T =>
    options.includes(v as T) ? (v as T) : d;

type Loose = Record<string, unknown>;

/** Turns whatever is in settings.json into a complete, valid item. */
export function normalizeItem(raw: unknown): LauncherItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Loose;
    const a = (r.action && typeof r.action === 'object' ? r.action : {}) as Loose;
    const sb = (r.statusBar && typeof r.statusBar === 'object' ? r.statusBar : {}) as Loose;

    let action: Action;
    switch (a.type) {
        case 'command':
            action = { type: 'command', commandId: str(a.commandId), args: str(a.args) };
            break;
        case 'url':
            action = { type: 'url', url: str(a.url) };
            break;
        case 'file':
            action = { type: 'file', path: str(a.path) };
            break;
        default:
            action = {
                type: 'terminal',
                command: str(a.command),
                cwd: str(a.cwd),
                onExisting: oneOf(a.onExisting, ['focus', 'rerun', 'new'] as const, 'focus'),
                location: oneOf(a.location, ['panel', 'editor'] as const, 'panel'),
                confirm: bool(a.confirm, false),
            };
    }

    const placements = Array.isArray(r.placements)
        ? (r.placements.filter((p) => p === 'statusBar' || p === 'sidebar' || p === 'editorTitle') as Placement[])
        : (['sidebar'] as Placement[]);

    const id = str(r.id).replace(/[^a-zA-Z0-9_]/g, '') || newId();

    return {
        id,
        label: str(r.label, 'Untitled'),
        icon: str(r.icon).replace(/^\$\(|\)$/g, ''),
        description: str(r.description),
        group: str(r.group),
        enabled: bool(r.enabled, true),
        placements,
        statusBar: {
            alignment: oneOf(sb.alignment, ['left', 'right'] as const, 'left'),
            priority: typeof sb.priority === 'number' ? sb.priority : 100,
            showLabel: bool(sb.showLabel, true),
            color: str(sb.color),
            background: oneOf(sb.background, ['none', 'warning', 'error'] as const, 'none'),
        },
        action,
    };
}

/** Drops empty strings so settings.json stays readable and diff-friendly. */
export function prune<T>(value: T): T {
    if (Array.isArray(value)) return value.map(prune) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Loose = {};
        for (const [k, v] of Object.entries(value as Loose)) {
            if (v === '' || v === undefined) continue;
            out[k] = prune(v);
        }
        return out as T;
    }
    return value;
}

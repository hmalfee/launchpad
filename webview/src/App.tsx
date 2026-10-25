import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ItemEditor } from '@/components/ItemEditor';
import { ItemList } from '@/components/ItemList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { resolvePick, send } from '@/lib/vscode';
import {
    ACTION_LABELS,
    type ActionType,
    type Intent,
    type LauncherItem,
    type Scope,
    type StatePayload,
    type ToWebview,
    createItem,
    defaultIcon,
} from '../../src/types';

interface Editing {
    scope: Scope;
    item: LauncherItem;
    isNew: boolean;
}

const QUICK_START: ActionType[] = ['terminal', 'command', 'url', 'file'];

export function App() {
    const [state, setState] = useState<StatePayload | null>(null);
    const [tab, setTab] = useState<Scope>('global');
    const [editing, setEditing] = useState<Editing | null>(null);
    const [commands, setCommands] = useState<string[]>([]);
    const [intent, setIntent] = useState<Intent | null>(null);
    const tabRef = useRef(tab);
    tabRef.current = tab;

    useEffect(() => {
        const onMessage = (event: MessageEvent<ToWebview>) => {
            const m = event.data;
            if (m.type === 'state') setState(m.state);
            else if (m.type === 'commands') setCommands(m.list);
            else if (m.type === 'picked') resolvePick(m.requestId, m.value);
            else if (m.type === 'intent') setIntent(m.intent);
        };
        window.addEventListener('message', onMessage);
        send({ type: 'ready' });
        return () => window.removeEventListener('message', onMessage);
    }, []);

    const startNew = useCallback((scope: Scope, type: ActionType = 'terminal') => {
        setTab(scope);
        setEditing({ scope, item: createItem(type), isNew: true });
    }, []);

    // Intents come from the sidebar ("Edit") and the "New Launcher" command.
    useEffect(() => {
        if (!intent || !state) return;
        if (intent.kind === 'new') {
            startNew(state.hasWorkspace && tabRef.current === 'workspace' ? 'workspace' : 'global');
        } else {
            const item = state[intent.scope].find((i) => i.id === intent.id);
            if (item) {
                setTab(intent.scope);
                setEditing({ scope: intent.scope, item, isNew: false });
            }
        }
        setIntent(null);
    }, [intent, state, startNew]);

    if (!state) return null;

    const commit = (scope: Scope, items: LauncherItem[]) => {
        setState({ ...state, [scope]: items });
        send({ type: 'save', scope, items });
    };

    const save = (scope: Scope, item: LauncherItem) => {
        if (!editing) return;
        const from = editing.scope;
        const upsert = (list: LauncherItem[]) =>
            list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item];

        if (editing.isNew || from === scope) {
            commit(scope, upsert(state[scope]));
        } else {
            // Moved between global and project: remove from the old scope, add to the new one.
            const next = { ...state, [from]: state[from].filter((i) => i.id !== item.id), [scope]: upsert(state[scope]) };
            setState(next);
            send({ type: 'save', scope: from, items: next[from] });
            send({ type: 'save', scope, items: next[scope] });
        }
        setTab(scope);
        setEditing(null);
    };

    const items = state[tab];
    const scopeName = tab === 'global' ? 'global' : 'project';

    return (
        <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-5 px-6 py-8">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold leading-tight">Launchpad</h1>
                    <p className="mt-1 max-w-xl text-muted-foreground">
                        Pin commands where you need them. Global launchers follow you into every window. Project launchers stay with this workspace.
                    </p>
                </div>
                <Button onClick={() => startNew(tab)} disabled={tab === 'workspace' && !state.hasWorkspace}>
                    <Icon name="add" />
                    New launcher
                </Button>
            </header>

            <div className="flex items-center justify-between gap-3">
                <Tabs value={tab} onValueChange={(v) => setTab(v as Scope)}>
                    <TabsList>
                        <TabsTrigger value="global">Global ({state.global.length})</TabsTrigger>
                        <TabsTrigger value="workspace" disabled={!state.hasWorkspace}>
                            {state.workspaceName ? `Project: ${state.workspaceName}` : 'Project'} ({state.workspace.length})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                <Button variant="ghost" size="sm" onClick={() => send({ type: 'openJson', scope: tab })}>
                    <Icon name="json" />
                    Open settings.json
                </Button>
            </div>

            {!state.hasWorkspace && (
                <p className="text-[12px] text-muted-foreground">Open a folder to create launchers that belong to a single project.</p>
            )}

            {items.length > 0 ? (
                <ItemList
                    items={items}
                    onChange={(next) => commit(tab, next)}
                    onEdit={(item) => setEditing({ scope: tab, item, isNew: false })}
                    onRun={(item) => send({ type: 'run', scope: tab, id: item.id })}
                />
            ) : (
                <section className="rounded-md border border-dashed border-border px-6 py-10">
                    <h2 className="text-[15px] font-semibold">No {scopeName} launchers yet</h2>
                    <p className="mt-1 max-w-lg text-muted-foreground">
                        A launcher runs a terminal command, triggers a VS Code command, or opens a URL or file. Start with one of these.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {QUICK_START.map((type) => (
                            <Button key={type} variant="secondary" onClick={() => startNew(tab, type)}>
                                <Icon name={defaultIcon(type)} />
                                {ACTION_LABELS[type]}
                            </Button>
                        ))}
                    </div>
                </section>
            )}

            {editing && (
                <ItemEditor
                    key={editing.item.id}
                    initial={editing.item}
                    initialScope={editing.scope}
                    isNew={editing.isNew}
                    hasWorkspace={state.hasWorkspace}
                    workspaceName={state.workspaceName}
                    commands={commands}
                    onSave={save}
                    onClose={() => setEditing(null)}
                />
            )}
        </main>
    );
}

import { type ReactNode, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { IconPicker } from '@/components/IconPicker';
import { Preview } from '@/components/Preview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { pickFile, send } from '@/lib/vscode';
import {
    ACTION_LABELS,
    type Action,
    type ActionType,
    type LauncherItem,
    type Placement,
    type Scope,
    defaultAction,
    defaultIcon,
} from '../../../src/types';

interface Props {
    initial: LauncherItem;
    initialScope: Scope;
    isNew: boolean;
    hasWorkspace: boolean;
    workspaceName: string;
    commands: string[];
    onSave: (scope: Scope, item: LauncherItem) => void;
    onClose: () => void;
}

const VARIABLES = '${file}  ${workspaceFolder}  ${selectedText}  ${clipboard}  ${prompt:Question}';

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {hint && <p className="text-[12px] leading-snug text-muted-foreground">{hint}</p>}
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3 border-t border-border px-5 py-4 first:border-t-0">
            <h3 className="text-[13px] font-semibold">{title}</h3>
            {children}
        </section>
    );
}

function Placement({
    title,
    description,
    checked,
    onChange,
    children,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    children?: ReactNode;
}) {
    return (
        <div className="rounded-md border border-border">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-[12px] text-muted-foreground">{description}</p>
                </div>
                <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
            </div>
            {checked && children && <div className="space-y-3 border-t border-border px-3 py-3">{children}</div>}
        </div>
    );
}

export function ItemEditor({ initial, initialScope, isNew, hasWorkspace, workspaceName, commands, onSave, onClose }: Props) {
    const [draft, setDraft] = useState<LauncherItem>(initial);
    const [scope, setScope] = useState<Scope>(initialScope);
    const [pickingIcon, setPickingIcon] = useState(false);
    // Remember what was typed for each action type so switching tabs never loses work.
    const [remembered, setRemembered] = useState<Partial<Record<ActionType, Action>>>({});

    const patch = (p: Partial<LauncherItem>) => setDraft((d) => ({ ...d, ...p }));
    const patchStatusBar = (p: Partial<LauncherItem['statusBar']>) =>
        setDraft((d) => ({ ...d, statusBar: { ...d.statusBar, ...p } }));
    const setAction = (action: Action) => setDraft((d) => ({ ...d, action }));

    const type = draft.action.type;
    const switchType = (next: string) => {
        const nextType = next as ActionType;
        setRemembered((r) => ({ ...r, [type]: draft.action }));
        setAction(remembered[nextType] ?? defaultAction(nextType));
    };

    useEffect(() => {
        if (type === 'command' && commands.length === 0) send({ type: 'requestCommands' });
    }, [type, commands.length]);

    const has = (p: Placement) => draft.placements.includes(p);
    const setPlacement = (p: Placement, on: boolean) =>
        patch({ placements: on ? [...draft.placements.filter((x) => x !== p), p] : draft.placements.filter((x) => x !== p) });

    const a = draft.action;
    const missing =
        !draft.label.trim()
            ? 'Give it a name.'
            : a.type === 'terminal' && !a.command.trim()
              ? 'Add at least one command.'
              : a.type === 'command' && !a.commandId.trim()
                ? 'Choose a VS Code command.'
                : a.type === 'url' && !a.url.trim()
                  ? 'Enter a URL.'
                  : a.type === 'file' && !a.path.trim()
                    ? 'Choose a file.'
                    : '';

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <header className="border-b border-border px-5 py-4">
                    <DialogTitle className="text-[15px] font-semibold">{isNew ? 'New launcher' : 'Edit launcher'}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-[12px] text-muted-foreground">
                        Choose what it does, then pin it where you want it.
                    </DialogDescription>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <Section title="Look">
                        <Preview item={draft} />
                        <Field label="Name" htmlFor="lp-name">
                            <Input
                                id="lp-name"
                                autoFocus={isNew}
                                placeholder="Start dev server"
                                value={draft.label}
                                onChange={(e) => patch({ label: e.target.value })}
                            />
                        </Field>
                        <Field label="Icon">
                            <Button variant="outline" className="w-full justify-start" onClick={() => setPickingIcon((v) => !v)}>
                                <Icon name={draft.icon || defaultIcon(draft)} />
                                <span className="font-normal">{draft.icon || 'Default for this action'}</span>
                                <Icon name={pickingIcon ? 'chevron-up' : 'chevron-down'} className="ml-auto text-muted-foreground" />
                            </Button>
                            {pickingIcon && (
                                <IconPicker
                                    value={draft.icon}
                                    onChange={(icon) => {
                                        patch({ icon });
                                        setPickingIcon(false);
                                    }}
                                />
                            )}
                        </Field>
                        <Field label="Tooltip" htmlFor="lp-desc" hint="Optional. Shown on hover. Defaults to the command itself.">
                            <Input id="lp-desc" value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
                        </Field>
                    </Section>

                    <Section title="What it does">
                        <Tabs value={type} onValueChange={switchType}>
                            <TabsList className="flex w-full">
                                {(Object.keys(ACTION_LABELS) as ActionType[]).map((t) => (
                                    <TabsTrigger key={t} value={t} className="flex-1">
                                        {ACTION_LABELS[t]}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        {a.type === 'terminal' && (
                            <div className="space-y-3">
                                <Field label="Commands" htmlFor="lp-cmd" hint="One per line. Each line runs in order.">
                                    <Textarea
                                        id="lp-cmd"
                                        rows={4}
                                        className="font-mono"
                                        placeholder={'pnpm install\npnpm dev'}
                                        value={a.command}
                                        onChange={(e) => setAction({ ...a, command: e.target.value })}
                                    />
                                </Field>
                                <Field label="Working directory" htmlFor="lp-cwd" hint="Relative to the project root. Leave empty to use the root.">
                                    <Input id="lp-cwd" value={a.cwd} onChange={(e) => setAction({ ...a, cwd: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="If it's already open">
                                        <Select value={a.onExisting} onValueChange={(v) => setAction({ ...a, onExisting: v as typeof a.onExisting })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="focus">Switch to it</SelectItem>
                                                <SelectItem value="rerun">Run again in it</SelectItem>
                                                <SelectItem value="new">Open another</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Open in">
                                        <Select value={a.location} onValueChange={(v) => setAction({ ...a, location: v as typeof a.location })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="panel">Terminal panel</SelectItem>
                                                <SelectItem value="editor">Editor area</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                                <label className="flex items-center justify-between gap-3">
                                    <span>Ask before running</span>
                                    <Switch checked={a.confirm} onCheckedChange={(confirm) => setAction({ ...a, confirm })} />
                                </label>
                            </div>
                        )}

                        {a.type === 'command' && (
                            <div className="space-y-3">
                                <Field label="Command id" htmlFor="lp-cid" hint="Start typing to search every command VS Code knows, including other extensions.">
                                    <Input
                                        id="lp-cid"
                                        list="lp-commands"
                                        className="font-mono"
                                        placeholder="workbench.action.toggleSidebarVisibility"
                                        value={a.commandId}
                                        onChange={(e) => setAction({ ...a, commandId: e.target.value })}
                                    />
                                    <datalist id="lp-commands">
                                        {commands.map((c) => (
                                            <option key={c} value={c} />
                                        ))}
                                    </datalist>
                                </Field>
                                <Field label="Arguments" htmlFor="lp-args" hint="Optional JSON. An array becomes several arguments.">
                                    <Textarea
                                        id="lp-args"
                                        rows={3}
                                        className="font-mono"
                                        placeholder={'{ "text": "hello" }'}
                                        value={a.args}
                                        onChange={(e) => setAction({ ...a, args: e.target.value })}
                                    />
                                </Field>
                            </div>
                        )}

                        {a.type === 'url' && (
                            <Field label="URL" htmlFor="lp-url">
                                <Input
                                    id="lp-url"
                                    placeholder="https://github.com/your/repo/issues"
                                    value={a.url}
                                    onChange={(e) => setAction({ ...a, url: e.target.value })}
                                />
                            </Field>
                        )}

                        {a.type === 'file' && (
                            <Field label="File" htmlFor="lp-file" hint="Relative paths resolve against the project root.">
                                <div className="flex gap-2">
                                    <Input id="lp-file" value={a.path} onChange={(e) => setAction({ ...a, path: e.target.value })} />
                                    <Button
                                        variant="secondary"
                                        onClick={async () => {
                                            const picked = await pickFile();
                                            if (picked) setAction({ ...a, path: picked });
                                        }}
                                    >
                                        Browse
                                    </Button>
                                </div>
                            </Field>
                        )}

                        <p className="text-[12px] leading-snug text-muted-foreground">
                            Variables work in every field above: <code className="font-mono">{VARIABLES}</code>
                        </p>
                    </Section>

                    <Section title="Where it appears">
                        <Placement title="Status bar" description="A button at the bottom of the window." checked={has('statusBar')} onChange={(v) => setPlacement('statusBar', v)}>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Side">
                                    <Select value={draft.statusBar.alignment} onValueChange={(v) => patchStatusBar({ alignment: v as 'left' | 'right' })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left">Left</SelectItem>
                                            <SelectItem value="right">Right</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Priority" htmlFor="lp-prio">
                                    <Input
                                        id="lp-prio"
                                        type="number"
                                        value={draft.statusBar.priority}
                                        onChange={(e) => patchStatusBar({ priority: Number(e.target.value) || 0 })}
                                    />
                                </Field>
                                <Field label="Text color" htmlFor="lp-color">
                                    <Input
                                        id="lp-color"
                                        placeholder="#4ec9b0"
                                        value={draft.statusBar.color}
                                        onChange={(e) => patchStatusBar({ color: e.target.value })}
                                    />
                                </Field>
                                <Field label="Highlight">
                                    <Select value={draft.statusBar.background} onValueChange={(v) => patchStatusBar({ background: v as 'none' | 'warning' | 'error' })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="warning">Warning</SelectItem>
                                            <SelectItem value="error">Error</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <label className="flex items-center justify-between gap-3">
                                <span>Show the name next to the icon</span>
                                <Switch checked={draft.statusBar.showLabel} onCheckedChange={(showLabel) => patchStatusBar({ showLabel })} />
                            </label>
                            <p className="text-[12px] text-muted-foreground">Higher priority sits closer to the left edge of its side.</p>
                        </Placement>

                        <Placement title="Sidebar" description="A row in the Launchpad view in the Activity Bar." checked={has('sidebar')} onChange={(v) => setPlacement('sidebar', v)}>
                            <Field label="Folder" htmlFor="lp-group" hint="Launchers with the same folder name are grouped. Leave empty for the top level.">
                                <Input id="lp-group" placeholder="Deploy" value={draft.group} onChange={(e) => patch({ group: e.target.value })} />
                            </Field>
                        </Placement>

                        <Placement title="Editor title bar" description="An icon button at the top right of every editor." checked={has('editorTitle')} onChange={(v) => setPlacement('editorTitle', v)}>
                            <p className="text-[12px] leading-snug text-muted-foreground">
                                VS Code only reads title bar buttons when a window loads, so you'll be asked to reload after saving.
                            </p>
                        </Placement>
                    </Section>

                    <Section title="Where it lives">
                        <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">Global: available in every window</SelectItem>
                                <SelectItem value="workspace" disabled={!hasWorkspace}>
                                    {hasWorkspace ? `This project: ${workspaceName || 'current workspace'} only` : 'This project (open a folder first)'}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {!isNew && (
                            <Button variant="ghost" size="sm" onClick={() => send({ type: 'copyKeybinding', scope: initialScope, id: initial.id })}>
                                <Icon name="keyboard" />
                                Copy keybinding snippet
                            </Button>
                        )}
                    </Section>
                </div>

                <footer className="flex items-center gap-3 border-t border-border px-5 py-3">
                    <p className="min-w-0 flex-1 truncate text-[12px] text-destructive">{missing}</p>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button disabled={Boolean(missing)} onClick={() => onSave(scope, { ...draft, label: draft.label.trim() })}>
                        {isNew ? 'Create launcher' : 'Save changes'}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}

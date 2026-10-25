import codiconCss from '@vscode/codicons/dist/codicon.css?raw';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';
import { isImageIcon } from '../../../src/types';

// Every icon VS Code ships, read straight from the codicon stylesheet.
const NAMES = [
    ...new Set([...codiconCss.matchAll(/\.codicon-([a-z0-9-]+)::?before/g)].map((m) => m[1])),
]
    .filter((n) => !n.startsWith('modifier'))
    .sort();

const SUGGESTED = [
    'terminal', 'play', 'rocket', 'beaker', 'bug', 'debug-alt', 'git-branch', 'git-pull-request',
    'package', 'server', 'database', 'cloud', 'sparkle', 'hubot', 'wand', 'tools',
    'gear', 'zap', 'flame', 'globe', 'link-external', 'file-code', 'folder-opened', 'refresh',
];

const LIMIT = 120;

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
    const [tab, setTab] = useState<'codicon' | 'url'>(isImageIcon(value) ? 'url' : 'codicon');
    const [query, setQuery] = useState('');
    const [urlDraft, setUrlDraft] = useState(isImageIcon(value) ? value : '');

    const q = query.trim().toLowerCase();
    const shown = useMemo(
        () => (q ? NAMES.filter((n) => n.includes(q)).slice(0, LIMIT) : SUGGESTED.filter((n) => NAMES.includes(n))),
        [q],
    );

    const tabCls = (active: boolean) =>
        cn(
            'rounded-sm px-2.5 py-1 text-[12px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring',
            active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
        );

    return (
        <div className="space-y-2 rounded-md border border-border p-2">
            <div className="flex gap-1">
                <button
                    type="button"
                    onClick={() => setTab('codicon')}
                    className={tabCls(tab === 'codicon')}
                >
                    Icons
                </button>
                <button
                    type="button"
                    onClick={() => setTab('url')}
                    className={tabCls(tab === 'url')}
                >
                    Image URL
                </button>
            </div>

            {tab === 'codicon' && (
                <>
                    <div className="flex gap-2">
                        <Input
                            autoFocus
                            placeholder={`Search ${NAMES.length} icons`}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <Button variant="outline" onClick={() => onChange('')} disabled={!value}>
                            Use default
                        </Button>
                    </div>
                    <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto">
                        {shown.map((name) => (
                            <button
                                key={name}
                                type="button"
                                title={name}
                                onClick={() => onChange(name)}
                                className={cn(
                                    'flex aspect-square items-center justify-center rounded-sm text-[18px] outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring',
                                    value === name && 'bg-primary text-primary-foreground hover:bg-primary',
                                )}
                            >
                                <Icon name={name} />
                            </button>
                        ))}
                        {!shown.length && <p className="col-span-8 py-3 text-center text-muted-foreground">No icon matches "{query}".</p>}
                    </div>
                    {!q && <p className="text-[12px] text-muted-foreground">Common picks. Search to see every icon.</p>}
                    {q && shown.length === LIMIT && (
                        <p className="text-[12px] text-muted-foreground">Showing the first {LIMIT}. Narrow your search to see more.</p>
                    )}
                </>
            )}

            {tab === 'url' && (
                <div className="space-y-2">
                    <Input
                        autoFocus
                        placeholder="https://example.com/logo.svg"
                        value={urlDraft}
                        onChange={(e) => {
                            setUrlDraft(e.target.value);
                            if (isImageIcon(e.target.value)) onChange(e.target.value);
                        }}
                    />
                    {urlDraft && !isImageIcon(urlDraft) && (
                        <p className="text-[12px] text-destructive">
                            Enter a URL ending in .svg, .png, .jpg, .jpeg, .gif, or .webp.
                        </p>
                    )}
                    {isImageIcon(urlDraft) && (
                        <div className="flex items-center gap-2">
                            <img src={urlDraft} alt="icon preview" className="h-8 w-8 object-contain" />
                            <p className="text-[12px] text-muted-foreground">Preview</p>
                        </div>
                    )}
                    <p className="text-[12px] text-muted-foreground">
                        Not shown in the status bar — falls back to the default icon there.
                    </p>
                </div>
            )}
        </div>
    );
}

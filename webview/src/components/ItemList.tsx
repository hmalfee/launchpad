import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';
import { type LauncherItem, PLACEMENT_LABELS, defaultIcon, summarizeAction } from '../../../src/types';

interface Props {
    items: LauncherItem[];
    onChange: (items: LauncherItem[]) => void;
    onEdit: (item: LauncherItem) => void;
    onRun: (item: LauncherItem) => void;
}

export function ItemList({ items, onChange, onEdit, onRun }: Props) {
    const update = (id: string, patch: Partial<LauncherItem>) =>
        onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const move = (index: number, by: -1 | 1) => {
        const next = [...items];
        const target = index + by;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const duplicate = (index: number) => {
        const src = items[index];
        const copy: LauncherItem = {
            ...structuredClone(src),
            id: Math.random().toString(36).slice(2, 10),
            label: `${src.label} copy`,
        };
        onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
    };

    return (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {items.map((item, index) => (
                <Row
                    key={item.id}
                    item={item}
                    first={index === 0}
                    last={index === items.length - 1}
                    onToggle={(enabled) => update(item.id, { enabled })}
                    onEdit={() => onEdit(item)}
                    onRun={() => onRun(item)}
                    onMove={(by) => move(index, by)}
                    onDuplicate={() => duplicate(index)}
                    onDelete={() => onChange(items.filter((i) => i.id !== item.id))}
                />
            ))}
        </ul>
    );
}

interface RowProps {
    item: LauncherItem;
    first: boolean;
    last: boolean;
    onToggle: (enabled: boolean) => void;
    onEdit: () => void;
    onRun: () => void;
    onMove: (by: -1 | 1) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

function Row({ item, first, last, onToggle, onEdit, onRun, onMove, onDuplicate, onDelete }: RowProps) {
    const [confirming, setConfirming] = useState(false);

    return (
        <li className={cn('group flex items-center gap-3 px-3 py-2.5 hover:bg-accent/60', !item.enabled && 'opacity-55')}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-[17px]">
                <Icon name={item.icon || defaultIcon(item)} />
            </span>

            <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left outline-none">
                <span className="block truncate font-medium">{item.label}</span>
                <span className="block truncate font-mono text-[12px] text-muted-foreground">
                    {summarizeAction(item.action)}
                </span>
            </button>

            <div className="hidden shrink-0 flex-wrap justify-end gap-1 md:flex">
                {item.placements.map((p) => (
                    <Badge key={p}>{PLACEMENT_LABELS[p]}</Badge>
                ))}
                {item.group.trim() && item.placements.includes('sidebar') && <Badge>{item.group.trim()}</Badge>}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
                <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button variant="ghost" size="icon-sm" className="h-3.5" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">
                        <Icon name="chevron-up" className="text-[12px]" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="h-3.5" disabled={last} onClick={() => onMove(1)} aria-label="Move down">
                        <Icon name="chevron-down" className="text-[12px]" />
                    </Button>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onRun} title="Run now" aria-label="Run now">
                    <Icon name="play" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit" aria-label="Edit">
                    <Icon name="edit" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onDuplicate} title="Duplicate" aria-label="Duplicate">
                    <Icon name="copy" />
                </Button>
                {confirming ? (
                    <Button variant="destructive" size="sm" onClick={onDelete} onBlur={() => setConfirming(false)} autoFocus>
                        Delete?
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon-sm" onClick={() => setConfirming(true)} title="Delete" aria-label="Delete">
                        <Icon name="trash" />
                    </Button>
                )}
                <Switch checked={item.enabled} onCheckedChange={onToggle} className="ml-2" aria-label={`Enable ${item.label}`} />
            </div>
        </li>
    );
}

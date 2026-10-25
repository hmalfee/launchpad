import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';
import { type LauncherItem, defaultIcon } from '../../../src/types';

/** Shows the launcher the way it will render in each place it's pinned. */
export function Preview({ item }: { item: LauncherItem }) {
    const label = item.label.trim() || 'Untitled';
    const icon = item.icon || defaultIcon(item);
    const { statusBar: o, placements } = item;

    const bg =
        o.background === 'error'
            ? 'var(--vscode-statusBarItem-errorBackground, #c72e0f)'
            : o.background === 'warning'
              ? 'var(--vscode-statusBarItem-warningBackground, #7a6400)'
              : 'transparent';
    const color = o.color && !o.color.includes('.') ? o.color : undefined;

    const chip = (
        <span
            className="inline-flex h-full items-center gap-1 px-2"
            style={{ background: bg, color }}
        >
            {(o.showLabel ? Boolean(item.icon) : true) && <Icon name={icon} className="text-[14px]" />}
            {o.showLabel && <span>{label}</span>}
        </span>
    );
    const ghost = (t: string) => <span className="px-2 opacity-70">{t}</span>;

    return (
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
            <p className="text-[12px] text-muted-foreground">Preview</p>

            {placements.includes('statusBar') && (
                <div
                    className="flex h-[22px] items-center justify-between overflow-hidden rounded-sm text-[12px]"
                    style={{
                        background: 'var(--vscode-statusBar-background, #007acc)',
                        color: 'var(--vscode-statusBar-foreground, #fff)',
                    }}
                >
                    <div className="flex h-full items-center">
                        {ghost('main')}
                        {o.alignment === 'left' && chip}
                    </div>
                    <div className="flex h-full items-center">
                        {o.alignment === 'right' && chip}
                        {ghost('Ln 12, Col 4')}
                    </div>
                </div>
            )}

            {placements.includes('sidebar') && (
                <div className="rounded-sm bg-card py-1 text-[13px]">
                    {item.group.trim() && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 text-muted-foreground">
                            <Icon name="chevron-down" className="text-[12px]" />
                            {item.group.trim()}
                        </div>
                    )}
                    <div className={cn('flex items-center gap-1.5 bg-accent px-2 py-0.5', item.group.trim() && 'pl-6')}>
                        <Icon name={icon} className="text-[15px]" />
                        <span>{label}</span>
                    </div>
                </div>
            )}

            {placements.includes('editorTitle') && (
                <div
                    className="flex h-[30px] items-stretch justify-between rounded-sm text-[12px]"
                    style={{ background: 'var(--vscode-editorGroupHeader-tabsBackground, transparent)' }}
                >
                    <span
                        className="flex items-center px-3"
                        style={{ background: 'var(--vscode-tab-activeBackground, var(--background))' }}
                    >
                        index.ts
                    </span>
                    <span className="flex items-center gap-1 px-2" title={label}>
                        <Icon name={icon} className="text-[16px]" />
                        <Icon name="ellipsis" className="text-[16px] text-muted-foreground" />
                    </span>
                </div>
            )}

            {!placements.length && (
                <p className="text-muted-foreground">
                    Not pinned anywhere. You can still run it from the command palette with “Launchpad: Run Launcher…”.
                </p>
            )}
        </div>
    );
}

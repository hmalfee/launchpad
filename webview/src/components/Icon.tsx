import { cn } from '@/lib/utils';

export function Icon({ name, className }: { name: string; className?: string }) {
    return <span aria-hidden className={cn('codicon', `codicon-${name}`, className)} />;
}

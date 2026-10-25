import { isImageIcon } from '../../../src/types';
import { cn } from '@/lib/utils';

export function Icon({ name, className }: { name: string; className?: string }) {
    if (isImageIcon(name))
        return <img src={name} aria-hidden className={cn('inline-block h-[1em] w-[1em] object-contain', className)} />;
    return <span aria-hidden className={cn('codicon', `codicon-${name}`, className)} />;
}

import type { ToExtension } from '../../../src/types';
import { newId } from '../../../src/types';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const api = acquireVsCodeApi();

export const send = (message: ToExtension): void => api.postMessage(message);

const waiting = new Map<string, (value: string | null) => void>();

/** Opens the native file dialog in the extension host and resolves with the chosen path. */
export function pickFile(): Promise<string | null> {
    const requestId = newId();
    return new Promise((resolve) => {
        waiting.set(requestId, resolve);
        send({ type: 'pickFile', requestId });
    });
}

export function resolvePick(requestId: string, value: string | null): void {
    waiting.get(requestId)?.(value);
    waiting.delete(requestId);
}

import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: 'src/extension.ts',
    format: 'cjs',
    deps: { neverBundle: ['vscode'] },
});

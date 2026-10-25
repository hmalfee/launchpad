import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

/** Thrown when the user dismisses a ${prompt:...} box. Aborts the run silently. */
export class Cancelled extends Error {}

export function workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function expandPath(p: string, base = workspaceRoot()): string {
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(1));
    return path.resolve(base ?? os.homedir(), p);
}

/**
 * Supported: ${workspaceFolder} ${workspaceFolderBasename} ${file} ${relativeFile}
 * ${fileBasename} ${fileBasenameNoExtension} ${fileDirname} ${fileExtname}
 * ${lineNumber} ${selectedText} ${clipboard} ${userHome} ${env:NAME} ${prompt:Question}
 */
export async function resolveVars(input: string): Promise<string> {
    if (!input.includes('${')) return input;

    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;
    const folder =
        (doc && vscode.workspace.getWorkspaceFolder(doc.uri)) ?? vscode.workspace.workspaceFolders?.[0];
    const root = folder?.uri.fsPath ?? '';
    const file = doc?.uri.scheme === 'file' ? doc.uri.fsPath : '';

    const simple: Record<string, string> = {
        workspaceFolder: root,
        workspaceFolderBasename: root ? path.basename(root) : '',
        file,
        relativeFile: file && root ? path.relative(root, file) : file,
        fileBasename: file ? path.basename(file) : '',
        fileBasenameNoExtension: file ? path.parse(file).name : '',
        fileDirname: file ? path.dirname(file) : '',
        fileExtname: file ? path.extname(file) : '',
        lineNumber: editor ? String(editor.selection.active.line + 1) : '',
        selectedText: editor ? (doc?.getText(editor.selection) ?? '') : '',
        userHome: os.homedir(),
    };

    const re = /\$\{(?:(prompt|env):([^}]*)|([A-Za-z]+))\}/g;
    let out = '';
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input))) {
        out += input.slice(last, m.index);
        last = m.index + m[0].length;
        const [whole, kind, arg, name] = m;
        if (kind === 'prompt') {
            const answer = await vscode.window.showInputBox({ prompt: arg || 'Value' });
            if (answer === undefined) throw new Cancelled();
            out += answer;
        } else if (kind === 'env') {
            out += process.env[arg] ?? '';
        } else if (name === 'clipboard') {
            out += await vscode.env.clipboard.readText();
        } else if (Object.hasOwn(simple, name)) {
            out += simple[name];
        } else {
            out += whole;
        }
    }
    return out + input.slice(last);
}

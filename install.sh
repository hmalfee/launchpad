#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG="$SCRIPT_DIR/package.json"

echo "Building extension and webview UI..."
pnpm --prefix "$SCRIPT_DIR" install --frozen-lockfile 2>/dev/null || pnpm --prefix "$SCRIPT_DIR" install
pnpm --prefix "$SCRIPT_DIR" build

PUBLISHER=$(node -p "require('$PKG').publisher")
NAME=$(node -p "require('$PKG').name")
VERSION=$(node -p "require('$PKG').version")
EXT_DIR="$HOME/.vscode/extensions"
DEST="$EXT_DIR/$PUBLISHER.$NAME-$VERSION"

# Preserve cached title bar icons from the previously installed version
ICON_CACHE_DIR="$EXT_DIR/$PUBLISHER.$NAME-icon-cache"
OLD_DEST=$(ls -d "$EXT_DIR/$PUBLISHER.$NAME-"*/ 2>/dev/null | grep -v "$ICON_CACHE_DIR" | grep -v "$DEST" | head -1)
OLD_DEST="${OLD_DEST%/}"
if [ -d "$OLD_DEST/dist/icon-cache" ]; then
    mkdir -p "$ICON_CACHE_DIR"
    cp -r "$OLD_DEST/dist/icon-cache/." "$ICON_CACHE_DIR/"
fi

# Remove other installed versions
shopt -s nullglob
for old in "$EXT_DIR/$PUBLISHER.$NAME-"*/; do
    if [ "${old%/}" != "$DEST" ]; then
        rm -rf "$old"
        echo "Removed old version: $old"
    fi
done
shopt -u nullglob

# Fresh copy. Layout mirrors the repo, so "main" needs no patching.
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$PKG" "$DEST/"
cp -r "$SCRIPT_DIR/dist" "$DEST/dist"
cp -r "$SCRIPT_DIR/media" "$DEST/media"

# Restore cached icons into DEST
if [ -d "$ICON_CACHE_DIR" ]; then
    mkdir -p "$DEST/dist/icon-cache"
    cp -r "$ICON_CACHE_DIR/." "$DEST/dist/icon-cache/"
    rm -rf "$ICON_CACHE_DIR"
fi

# Pre-populate title bar buttons in the installed package.json from VS Code's globalState
# so Launchpad doesn't detect a manifest change and prompt for a second reload on startup.
node -e "
    const fs = require('fs');
    const path = require('path');
    const { createHash } = require('crypto');
    let DatabaseSync;
    try {
        ({ DatabaseSync } = require('node:sqlite'));
    } catch {
        process.exit(0);
    }

    const home = process.env.HOME || '';
    const candidates = [
        path.join(home, '.config/Code/User/globalStorage/state.vscdb'),
        path.join(home, 'Library/Application Support/Code/User/globalStorage/state.vscdb'),
    ];
    const vscdbPath = candidates.find(p => fs.existsSync(p));
    if (!vscdbPath) process.exit(0);

    let state = {};
    try {
        const db = new DatabaseSync(vscdbPath, { open: true, readOnly: true });
        const row = db.prepare(\"SELECT value FROM ItemTable WHERE key = ?\").get('local.$NAME');
        db.close();
        if (row?.value) {
            state = JSON.parse(typeof row.value === 'string' ? row.value : Buffer.from(row.value).toString('utf8'));
        }
    } catch {
        process.exit(0);
    }

    const registry = state['launchpad.titleRegistry'];
    if (!registry || typeof registry !== 'object') process.exit(0);

    const destPkg = path.join('$DEST', 'package.json');
    if (!fs.existsSync(destPkg)) process.exit(0);

    const pkg = JSON.parse(fs.readFileSync(destPkg, 'utf8'));
    const PREFIX = 'launchpad.t.';
    const entries = Object.values(registry).flat();
    const keep = (list = []) => list.filter((x) => !x.command.startsWith(PREFIX));

    async function ensureIconsAndWrite() {
        const resolvedEntries = await Promise.all(entries.map(async (e) => {
            if (typeof e.icon !== 'string') {
                const url = e.icon.light;
                const ext = url.split('?')[0].match(/\\.(svg|png|jpe?g|gif|webp)$/i)?.[0] ?? '.svg';
                const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
                const rel = \`dist/icon-cache/\${hash}\${ext}\`;
                const dest = path.join('$DEST', rel);
                
                if (!fs.existsSync(dest)) {
                    try {
                        const res = await fetch(url);
                        if (res.ok) {
                            const buf = Buffer.from(await res.arrayBuffer());
                            fs.mkdirSync(path.dirname(dest), { recursive: true });
                            fs.writeFileSync(dest, buf);
                        }
                    } catch {}
                }
                const local = fs.existsSync(dest) ? rel : undefined;
                return {
                    ...e,
                    icon: local ? { light: local, dark: local } : '\$(extensions)',
                };
            }
            return e;
        }));

        pkg.contributes ??= {};
        pkg.contributes.menus ??= {};
        const menus = pkg.contributes.menus;

        pkg.contributes.commands = [
            ...keep(pkg.contributes.commands),
            ...resolvedEntries.map((e) => ({ command: e.command, title: e.title, category: 'Launchpad', icon: e.icon })),
        ];
        menus['editor/title'] = [
            ...keep(menus['editor/title']),
            ...resolvedEntries.map((e, i) => ({ command: e.command, when: e.ctx, group: \`navigation@\${i + 1}\` })),
        ];
        menus.commandPalette = [
            ...keep(menus.commandPalette),
            ...entries.map((e) => ({ command: e.command, when: 'false' })),
        ];

        const after = JSON.stringify(pkg, null, 4) + '\n';
        fs.writeFileSync(destPkg, after);
        const hash = createHash('sha256').update(after).digest('hex').slice(0, 16);
        state['launchpad.titleManifestHash'] = hash;
        const dbW = new DatabaseSync(vscdbPath, { open: true });
        dbW.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)').run('local.$NAME', JSON.stringify(state));
        dbW.close();
    }

    ensureIconsAndWrite().catch(() => {});
"

# Register in extensions.json and clear any .obsolete flag
node -e "
    const fs = require('fs');
    const path = require('path');
    const extId = '$PUBLISHER.$NAME';
    const folder = '$PUBLISHER.$NAME-$VERSION';
    const extsDir = '$EXT_DIR';
    const dest = '$DEST';

    const obsoletePath = path.join(extsDir, '.obsolete');
    if (fs.existsSync(obsoletePath)) {
        try {
            const obsolete = JSON.parse(fs.readFileSync(obsoletePath, 'utf8'));
            delete obsolete[folder];
            if (Object.keys(obsolete).length === 0) fs.unlinkSync(obsoletePath);
            else fs.writeFileSync(obsoletePath, JSON.stringify(obsolete) + '\n');
        } catch {}
    }

    const regPath = path.join(extsDir, 'extensions.json');
    let reg = [];
    if (fs.existsSync(regPath)) {
        try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch {}
    }
    reg = reg.filter(e => e?.identifier?.id?.toLowerCase() !== extId.toLowerCase());
    reg.push({
        identifier: { id: extId },
        version: '$VERSION',
        location: { '\$mid': 1, path: dest, scheme: 'file' },
        relativeLocation: folder,
        metadata: { installedTimestamp: Date.now(), pinned: false, source: 'local' }
    });
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + '\n');
"

echo "Installed to: $DEST"
echo "Reload VS Code (Developer: Reload Window) to apply."

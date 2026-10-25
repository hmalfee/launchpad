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
echo "Note: reinstalling resets title bar buttons; Launchpad rewrites them on first start and asks for one more reload."

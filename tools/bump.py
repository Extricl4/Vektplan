#!/usr/bin/env python3
"""Release a new version of Vektplan.

Updates the version number in js/version.js, sw.js and version.json, and refreshes
the list of files the service worker keeps for offline use.

Usage:
  python3 tools/bump.py 1.0.1 "What changed" ["Hva som er nytt"]
  python3 tools/bump.py --assets-only        # only refresh the offline file list
"""
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def asset_list():
    files = ['./', './index.html', './manifest.webmanifest']
    for folder in ['css', 'js', 'fonts', 'icons']:
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_file() and not path.name.startswith('.'):
                files.append('./' + path.relative_to(ROOT).as_posix())
    return files


def write_sw(version=None):
    sw_path = ROOT / 'sw.js'
    text = sw_path.read_text()
    if version:
        text = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{version}';", text)
    listing = ',\n'.join(f"  '{a}'" for a in asset_list())
    text = re.sub(r"const ASSETS = \[[\s\S]*?\];", f"const ASSETS = [\n{listing},\n];", text)
    sw_path.write_text(text)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    if args[0] == '--assets-only':
        write_sw()
        print('Offline file list refreshed.')
        return
    version = args[0]
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        sys.exit('Version must look like 1.2.3')
    notes_en = args[1] if len(args) > 1 else ''
    notes_nb = args[2] if len(args) > 2 else notes_en

    (ROOT / 'js' / 'version.js').write_text(f"export const APP_VERSION = '{version}';\n")
    vj_path = ROOT / 'version.json'
    old = json.loads(vj_path.read_text()) if vj_path.exists() else {}
    history = old.get('history', [])
    if old.get('version'):
        history.insert(0, {k: old[k] for k in ('version', 'date', 'notes', 'notes_nb') if k in old})
    data = {
        'version': version,
        'date': datetime.date.today().isoformat(),
        'notes': notes_en,
        'notes_nb': notes_nb,
        'history': history[:20],
    }
    vj_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    write_sw(version)
    print(f'Vektplan is now version {version}. Commit and push to publish it.')


if __name__ == '__main__':
    main()

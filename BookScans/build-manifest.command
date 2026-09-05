#!/bin/zsh
set -e

cd "$(dirname "$0")"

python3 - <<'PY'
from pathlib import Path
import json

root = Path.cwd()
books = [
    "Anointing",
    "Baptism",
    "Confirmation",
    "Funerals",
    "Matrimony",
    "OCIA",
    "Ordination",
    "Outside",
    "Penance",
    "Pontifical",
]

manifest = {}

for book in books:
    folder = root / book
    if not folder.is_dir():
        manifest[book] = []
        print(f"WARNING: folder not found: {book}")
        continue

    files = [
        p.name for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg"}
    ]

    # The filenames use zero-padded numbers, so case-insensitive lexical
    # sorting preserves the intended scan order, including 000a, 000b, etc.
    files.sort(key=lambda s: s.lower())
    manifest[book] = files
    print(f"{book}: {len(files)} image(s)")

out = "window.BOOKSCANS_MANIFEST = " + json.dumps(
    manifest, ensure_ascii=False, indent=2
) + ";\n"

(root / "manifest.js").write_text(out, encoding="utf-8")
print("\nUpdated manifest.js")
print("You can now open index.html in Safari or Chrome.")
PY

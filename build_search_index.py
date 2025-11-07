# build_search_index.py
# Rebuilds search-index.json and updates the embedded JSON block in index.html
# Place this file in your site root (same folder as index.html) and run:
#   python3 build_search_index.py

import os
import re
import json
import sys

SITE_DIR = os.path.abspath(os.path.dirname(__file__))
INDEX_JSON_PATH = os.path.join(SITE_DIR, "search-index.json")
INDEX_HTML_PATH = os.path.join(SITE_DIR, "index.html")

META_RE = re.compile(r'<meta\s+[^>]*name=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*>', re.I)
HEAD_RE = re.compile(r'<head\b[^>]*>(.*?)</head>', re.I | re.S)

def parse_meta(head_html: str):
    metas = {}
    for m in META_RE.finditer(head_html):
        name = m.group(1).strip().lower()
        content = m.group(2).strip()
        metas[name] = content
    return metas

def normalize_tags(s: str):
    if not s:
        return []
    return [t.strip() for t in s.split(",") if t.strip()]

def should_include(metas: dict) -> bool:
    return metas.get("searchable", "").lower() == "true"

def extract_title_fallback(filename: str) -> str:
    base = os.path.splitext(os.path.basename(filename))[0]
    # Replace dashes/underscores with spaces and title-case
    return re.sub(r'[_-]+', ' ', base).strip().title()

def build_entry(filename: str, metas: dict) -> dict:
    entry = {
        "title": metas.get("title") or extract_title_fallback(filename),
        "url": filename
    }
    author = (metas.get("author") or "").strip()
    year = (metas.get("year") or "").strip()
    tags = normalize_tags(metas.get("tags") or "")

    # Only include non-empty fields
    if author:
        entry["author"] = author
    if year:
        entry["year"] = year
    if tags:
        entry["tags"] = tags
    return entry

def scan_site(dir_path: str):
    entries = []
    for name in os.listdir(dir_path):
        if not name.lower().endswith(".html"):
            continue
        path = os.path.join(dir_path, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                html = f.read()
        except Exception as e:
            print(f"[warn] skipping {name}: {e}", file=sys.stderr)
            continue

        head_match = HEAD_RE.search(html)
        head_html = head_match.group(1) if head_match else html
        metas = parse_meta(head_html)

        if should_include(metas):
            entry = build_entry(name, metas)
            entries.append(entry)

    # Stable sort by title
    entries.sort(key=lambda e: e.get("title", "").lower())
    return entries

def write_json(entries, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f"[ok] wrote {path} ({len(entries)} items)")

def update_index_html(entries, index_html_path):
    try:
        with open(index_html_path, "r", encoding="utf-8") as f:
            html = f.read()
    except Exception as e:
        print(f"[warn] cannot open {index_html_path}: {e}", file=sys.stderr)
        return

    script_open = '<script id="site-search-index" type="application/json">'
    script_close = '</script>'
    payload = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    block = f"{script_open}\n{payload}\n{script_close}"

    # If a block already exists, replace it. Otherwise, insert before your Utilities/script.js include or before </body>.
    if re.search(r'<script id="site-search-index" type="application/json">.*?</script>', html, re.I | re.S):
        html_new = re.sub(
            r'<script id="site-search-index" type="application/json">.*?</script>',
            block,
            html,
            flags=re.I | re.S
        )
        action = "replaced"
    else:
        insert_re = re.compile(r'(<script[^>]+Utilities/script\.js[^>]*>\s*</script>)', re.I)
        if insert_re.search(html):
            html_new = insert_re.sub(block + "\n" + r"\1", html, count=1)
            # the backreference won't expand inside sub like that; do a manual replace
            m = insert_re.search(html)
            if m:
                start = m.start(1)
                end = m.end(1)
                html_new = html[:start] + block + "\n" + html[start:]
        else:
            html_new = re.sub(r'</body>', block + "\n</body>", html, flags=re.I)
        action = "inserted"

    with open(index_html_path, "w", encoding="utf-8") as f:
        f.write(html_new)
    print(f"[ok] {action} embedded index into {index_html_path}")

def main():
    entries = scan_site(SITE_DIR)
    write_json(entries, INDEX_JSON_PATH)
    update_index_html(entries, INDEX_HTML_PATH)

if __name__ == "__main__":
    main()
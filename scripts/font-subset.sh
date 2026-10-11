#!/usr/bin/env bash
# Rebuilds vendor/fonts/zen-old-mincho-700-subset.woff2: Zen Old Mincho Bold with only the characters the site uses
# (every Japanese character in data/, the pages and the tour, plus ASCII and a few punctuation marks), about 100 KB
# instead of Google's full 1.5 MB in slices. Run it after adding Japanese text to the trip, then commit the two files
# it writes (the font and the .glyphs.txt list; npm test fails if a character the site shows is missing from the list).
# Google Fonts' `text=` parameter does the subsetting; the licence (vendor/fonts/LICENSE-zen-old-mincho, SIL OFL) allows this.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=vendor/fonts/zen-old-mincho-700-subset
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 - "$TMP" <<'PY'
import glob, sys, urllib.parse
files = glob.glob('data/*.js') + ['index.html', 'hub/index.html', 'prototypes/tools.html', 'money.html', 'photos.html', 'js/tour.js']
cjk = lambda o: 0x2E80 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0xFF00 <= o <= 0xFFEF or 0x3000 <= o <= 0x303F
chars = {ch for f in files for ch in open(f, encoding='utf-8').read() if cjk(ord(ch))}
text = ''.join(sorted(chars | {chr(c) for c in range(0x20, 0x7f)} | set('…–—‘’“”¥〜')))
open(sys.argv[1] + '/glyphs.txt', 'w', encoding='utf-8').write(text)
open(sys.argv[1] + '/url.txt', 'w').write('https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@700&text=' + urllib.parse.quote(text, safe=''))
print(len(text), 'characters')
PY
# a browser that takes woff2, so the stylesheet points at a woff2 file
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
curl -fsS -A "$UA" -o "$TMP/font.css" "$(cat "$TMP/url.txt")"
URL=$(grep -o 'https://fonts.gstatic.com/[^)]*' "$TMP/font.css" | head -1)
[ -n "$URL" ] || { echo "no font url in Google's stylesheet"; exit 1; }
curl -fsS -A "$UA" -o "$TMP/font.woff2" "$URL"
cp "$TMP/font.woff2" "$OUT.woff2"; cp "$TMP/glyphs.txt" "$OUT.glyphs.txt"
ls -la "$OUT.woff2" "$OUT.glyphs.txt"

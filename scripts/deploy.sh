#!/usr/bin/env bash
# Copy the trips hub (hub/) to the site root and the Japan app into dist/japan/, then upload to Cloudflare Pages.
# The site is served at ourtrips.date/japan/; the API stays at /api/.
# Needs CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) in the environment.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/japan
cp -r hub/. dist/
cp -r index.html classic.html manifest.webmanifest sw.js css data icons img js vendor prototypes dist/japan/
cat > dist/_redirects <<'EOF'
/japan   /japan/ 301
/Japan   /japan/ 301
/Japan/* /japan/:splat 301
/JAPAN   /japan/ 301
/japan/prototypes/mix  /japan/ 301
/japan/prototypes/mix.html  /japan/ 301
EOF
# Code and data must never come stale from the browser cache (Pages defaults JS to 4 hours). Photos can cache.
cat > dist/_headers <<'EOF'
/
  Cache-Control: no-cache
/japan/
  Cache-Control: no-cache
/japan/*.html
  Cache-Control: no-cache
/japan/js/*
  Cache-Control: no-cache
/japan/data/*
  Cache-Control: no-cache
/japan/css/*
  Cache-Control: no-cache
/japan/prototypes/*
  Cache-Control: no-cache
/japan/sw.js
  Cache-Control: no-cache
/japan/img/*
  Cache-Control: public, max-age=604800
EOF
[ "${BUILD_ONLY:-}" = 1 ] && exit 0
npx -y wrangler@4 pages deploy --branch main "$@"

#!/usr/bin/env bash
# Copy only the public site into dist/japan/ and upload it to Cloudflare Pages.
# The site is served at ourtrips.date/japan/; the API stays at /api/.
# Needs CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) in the environment.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/japan
cp -r index.html manifest.webmanifest sw.js css data icons img js vendor dist/japan/
cat > dist/_redirects <<'EOF'
/        /japan/ 302
/japan   /japan/ 301
/Japan   /japan/ 301
/Japan/* /japan/:splat 301
/JAPAN   /japan/ 301
EOF
npx -y wrangler@4 pages deploy --branch main "$@"

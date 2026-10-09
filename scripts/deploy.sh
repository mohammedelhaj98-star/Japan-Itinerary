#!/usr/bin/env bash
# Copy only the public site into dist/ and upload it to Cloudflare Pages.
# Needs CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) in the environment.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
cp -r index.html manifest.webmanifest sw.js css data icons img js vendor dist/
npx -y wrangler@4 pages deploy --branch main "$@"

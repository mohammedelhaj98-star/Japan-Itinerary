#!/usr/bin/env bash
# Puts face recognition's server (workers/faces) live as the Worker "japan2026-faces", with its container. Needs Docker
# running (the container is built here and uploaded), and CLOUDFLARE_API_TOKEN with "Workers Scripts: Edit" and
# "Containers: Edit", plus CLOUDFLARE_ACCOUNT_ID. The site reaches it through the FACES service binding (wrangler.toml).
# First time only: set the same random FACES_KEY on both, for the minute's sweep:
#   k=$(openssl rand -hex 24); echo $k | npx wrangler secret put FACES_KEY --config workers/faces/wrangler.toml
#   echo $k | npx wrangler pages secret put FACES_KEY --project-name japan2026
set -euo pipefail
cd "$(dirname "$0")/../workers/faces"
./fetch-parts.sh
npm install --no-audit --no-fund -q
npx -y wrangler@4 deploy "$@"

#!/usr/bin/env bash
# Puts the shared-state Durable Object (workers/state) live as the Worker "japan2026-state". Run once, by hand, with
# CLOUDFLARE_API_TOKEN (a token with "Workers Scripts: Edit"; the Pages-only token used for deploys isn't enough) and
# CLOUDFLARE_ACCOUNT_ID set. Then uncomment the TRIP_DO binding in wrangler.toml and deploy the site: from the next
# visit every phone reads and writes the object, and KV's data is copied in on first contact (lib/state-store.js).
set -euo pipefail
cd "$(dirname "$0")/.."
# --keep-vars: keys added in the Cloudflare dashboard as plain variables (e.g. AIRLABS_KEY) survive a deploy
npx -y wrangler@4 deploy --keep-vars --config workers/state/wrangler.toml "$@"
echo
echo "Deployed. Now uncomment the [[durable_objects.bindings]] block in wrangler.toml and deploy the site (push to main)."

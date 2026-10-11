#!/usr/bin/env bash
# Put an earlier version of the site back live (Cloudflare Pages rollback: instant, nothing is rebuilt).
#   bash scripts/rollback.sh            list the last 10 live versions
#   bash scripts/rollback.sh previous   go back to the version before the live one
#   bash scripts/rollback.sh <id>       go back to that version (the first 8 characters of an id from the list are enough)
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. The data (expenses, ticks, photos) is not touched, only the code.
set -euo pipefail
API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/japan2026/deployments"
list=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$API?env=production&per_page=10")
# what's live: after a rollback it isn't the newest
live=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "${API%/deployments}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["canonical_deployment"]["id"])')
rows=$(LIVE="$live" python3 -c '
import json, os, sys
for i, d in enumerate(json.load(sys.stdin)["result"]):
    m = (d.get("deployment_trigger") or {}).get("metadata") or {}
    msg = (m.get("commit_message") or "").splitlines()[0][:60] if m.get("commit_message") else ""
    print(d["id"], d["created_on"][:16].replace("T", " "), (m.get("commit_hash") or "")[:7], "LIVE" if d["id"] == os.environ["LIVE"] else d["latest_stage"]["status"], msg, sep="\t")
' <<<"$list")
if [ -z "${1:-}" ]; then echo "Versions, newest first (LIVE is the one people see now):"; echo "$rows" | cut -c1-8,37-; exit 0; fi
if [ "$1" = previous ]; then target=$(echo "$rows" | awk -F'\t' 'seen && $4=="success" {print $1; exit} $4=="LIVE" {seen=1}')
else target=$(echo "$rows" | awk -F'\t' -v p="$1" 'index($1,p)==1 {print $1; exit}'); fi
[ -n "$target" ] || { echo "No version matching '$1' in the last 10."; exit 1; }
echo "Rolling back to: $(echo "$rows" | grep "^$target" | cut -f2-)"
curl -fsS -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$API/$target/rollback" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("Done: that version is live." if d["success"] else d["errors"])'

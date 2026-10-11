# Checks the live /api/scan against receipt photos with known answers.
# The endpoint needs the PIN, or a temporary test key: add a SCAN_TEST_KEY secret to the Pages project and accept it
# in the scan route (`x-scan-test` header) while testing, then remove both. Cloudflare blocks Python's default user agent.
#   python3 tests/receipts/run.py <key>
import json, base64, urllib.request, sys, os, concurrent.futures as cf
HERE = os.path.dirname(os.path.abspath(__file__)); KEY = sys.argv[1]
truth = json.load(open(os.path.join(HERE, 'truth.json')))
def call(k):
    f = os.path.join(HERE, truth[k]['file']); mime = 'image/png' if f.endswith('png') else 'image/jpeg'
    body = json.dumps({'photo': f'data:{mime};base64,' + base64.b64encode(open(f, 'rb').read()).decode()}).encode()
    req = urllib.request.Request('https://ourtrips.date/api/scan', data=body, method='POST', headers={'content-type': 'application/json', 'x-scan-test': KEY, 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'})
    try: return json.loads(urllib.request.urlopen(req, timeout=120).read())
    except Exception as e: return {'error': str(e)}
with cf.ThreadPoolExecutor(6) as ex: res = dict(zip(truth, ex.map(call, truth)))
ok = 0
for k, t in truth.items():
    r = res[k]; good = r.get('total') == t['total']; ok += good
    print(f"{k:10} {'✓' if good else '✗'} total {r.get('total')} (want {t['total']}) pretax {r.get('pretax')} shop {r.get('shop_en') or r.get('shop')} date {r.get('date')} type {r.get('type')} taxfree {r.get('taxfree')} {r.get('error') or ''}")
print(f'totals right: {ok}/{len(truth)}')

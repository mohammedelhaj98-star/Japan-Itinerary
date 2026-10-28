# The faces container's web server: POST /look?rot=90 with a photo's bytes → what's in it (look.py), as JSON.
# GET / answers once the models are loaded (the Worker waits for that before sending photos).
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import look


class H(BaseHTTPRequestHandler):
    def send(self, code, obj):
        b = json.dumps(obj, separators=(',', ':')).encode()
        self.send_response(code); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        self.send(200, {'ok': True})

    def do_POST(self):
        if not self.path.startswith('/look'): return self.send(404, {'error': 'not here'})
        n = int(self.headers.get('content-length') or 0)
        if not 0 < n < 20_000_000: return self.send(400, {'error': 'no photo'})
        data = self.rfile.read(n)
        try: rot = int((self.path.split('rot=') + ['0'])[1].split('&')[0]) % 360
        except ValueError: rot = 0
        try: self.send(200, look.look(data, rot if rot in (0, 90, 180, 270) else 0))
        except Exception as e: self.send(422, {'error': 'could not read that picture', 'why': str(e)[:200]})

    def log_message(self, *a): pass


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1]) if len(sys.argv) > 1 else 8080), H).serve_forever()

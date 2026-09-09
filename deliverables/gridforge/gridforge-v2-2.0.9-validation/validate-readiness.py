"""Exercise the actual test.sh readiness block using local HTTP servers."""
import http.server
import json
import os
from pathlib import Path
import subprocess
import threading
import time

runner = Path('/tests/test.sh').read_text()
start = runner.index('# Wait for an HTTP response here')
end = runner.index('if ! timeout --signal=TERM', start)
probe = runner[start:end]
assert runner.index('bash /tests/app-control.sh start') < start < runner.index('rewardkit --max-concurrent-agent')
command = probe + '\nprintf "GRADING_MAY_START\\n"\n'
env = dict(os.environ, LOG_DIR='/logs/verifier')
Path(env['LOG_DIR']).mkdir(parents=True, exist_ok=True)

class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.requests.append(self.path)
        self.send_response(200 if self.path == '/' else 404)
        self.end_headers()
        self.wfile.write(b'ready')

    def log_message(self, *args):
        pass

results = []
for delay in (0, 1.5):
    server = Server(('127.0.0.1', 3000), Handler, bind_and_activate=False)
    server.requests = []
    def serve():
        time.sleep(delay)
        server.server_bind()
        server.server_activate()
        server.serve_forever()
    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    try:
        before = time.monotonic()
        result = subprocess.run(['bash', '-c', command], env=env, capture_output=True, text=True, timeout=15)
        elapsed = time.monotonic() - before
        assert result.returncode == 0 and 'GRADING_MAY_START' in result.stdout
        assert '/health' in server.requests and '/' in server.requests
        assert elapsed >= delay
        results.append({'case': 'delayed startup' if delay else 'root-only server',
                        'passed': True, 'elapsed_seconds': round(elapsed, 2)})
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

before = time.monotonic()
result = subprocess.run(['bash', '-c', command], env=env, capture_output=True, text=True, timeout=45)
assert 'GRADING_MAY_START' not in result.stdout
assert 'Application readiness timed out' in Path('/logs/verifier/app.log').read_text()
results.append({'case': 'unavailable server prevents grading', 'passed': True,
                'elapsed_seconds': round(time.monotonic() - before, 2)})
Path('/results/readiness-regression.json').write_text(json.dumps({'results': results}, indent=2) + '\n')
print(json.dumps(results, indent=2))

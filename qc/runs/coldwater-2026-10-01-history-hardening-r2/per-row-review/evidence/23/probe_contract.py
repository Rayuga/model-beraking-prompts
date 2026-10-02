"""Focused liveness-contract experiment; no configured judge or Docker run."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
import re
import subprocess
import sys
import threading

root = Path('.qc-cache/coldwater-2026-10-01-history-hardening-r2')
entry = root / 'task/tests/test.sh'
source = entry.read_text(encoding='utf-8')
probe = re.search(r"python3 - <<'PY' >/dev/null 2>&1\n(.*?)\nPY", source, re.S).group(1)
results = []
for name, status, body in [
    ('conforming_health_plain_text', 200, b'ready'),
    ('conforming_health_no_content', 204, b''),
    ('broken_health_500', 500, b'failed'),
]:
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            self.send_response(status)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        # Change only the port to avoid other reviewers' services.
        code = probe.replace('127.0.0.1:3000', f'127.0.0.1:{server.server_port}')
        environment = {key: value for key, value in os.environ.items() if 'proxy' not in key.lower()}
        environment['NO_PROXY'] = '127.0.0.1,localhost'
        run = subprocess.run([sys.executable, '-B', '-c', code], capture_output=True, text=True, timeout=10, env=environment)
        results.append({'case': name, 'status': status, 'probe_exit': run.returncode,
                        'requests': list(requests), 'stderr': run.stderr})
        assert run.returncode == 0, (name, run.stderr)
        assert requests == ['/api/health'], requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

report = {
    'scope': 'Extracted Python readiness probe only; ephemeral loopback port; not test.sh or configured judges.',
    'input_sha256': 'b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863',
    'test_sh_sha256': hashlib.sha256(entry.read_bytes()).hexdigest(),
    'template_test_sh_identical': entry.read_bytes() == (root / 'rules/projects/webdev-task-template/tests/test.sh').read_bytes(),
    'environment_note': 'Host proxy variables removed and NO_PROXY set for loopback. Initial host-proxy attempt reached no local fixture and is preserved as attempt1-invalid, not evidence.',
    'results': results,
    'interpretation': 'Both conforming health alternatives satisfy readiness without JSON. A broken 500 also satisfies readiness, which alone is not a product pass; constraints judge.toml:23 explicitly requires a successful health response and lines 25-29 require fresh shared saved data.',
}
out = Path(__file__).with_name('probe_contract.json')
out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))

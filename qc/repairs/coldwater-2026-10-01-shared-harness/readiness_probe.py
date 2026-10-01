"""Exercise the exact readiness functions with local HTTP fixtures in Docker."""

from pathlib import Path
import hashlib
import json
import os
import signal
import socket
import subprocess
import tempfile
import time


SOURCE = Path('/proposal')
OUTPUT = Path('/evidence')


def functions(name):
    source = (SOURCE / name).read_text()
    return source[source.index('probe_ready() {'):source.index('write_zero_reward\ntrap cleanup EXIT')]


def launch(script):
    script.chmod(0o644)
    proc = subprocess.Popen(
        ['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'node', str(script)],
        start_new_session=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(100):
        if proc.poll() is not None:
            raise RuntimeError(f'fixture exited with {proc.returncode}')
        try:
            with socket.create_connection(('127.0.0.1', 3000), timeout=0.1):
                return proc
        except OSError:
            time.sleep(0.03)
    raise RuntimeError('fixture did not listen')


def stop(proc):
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait(timeout=3)


def command(body, timeout):
    start = time.monotonic()
    try:
        result = subprocess.run(['bash', '-c', 'set -euo pipefail\n' + body],
                                capture_output=True, text=True, timeout=timeout)
        return {'exit_code': result.returncode,
                'elapsed_seconds': round(time.monotonic() - start, 3),
                'timed_out_by_driver': False,
                'stderr': result.stderr[-1000:]}
    except subprocess.TimeoutExpired:
        return {'exit_code': None,
                'elapsed_seconds': round(time.monotonic() - start, 3),
                'timed_out_by_driver': True}


with tempfile.TemporaryDirectory() as directory:
    base = Path(directory)
    base.chmod(0o755)
    good = base / 'good.js'
    good.write_text("const net=require('net');net.createServer(s=>s.end('HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\n\\r\\nOK')).listen(3000,'0.0.0.0');\n")
    slow = base / 'slow.js'
    slow.write_text("const net=require('net');net.createServer(s=>{s.write('HTTP/1.1 200 OK\\r\\nX-Pad: ');const id=setInterval(()=>s.write('a'),100);s.on('close',()=>clearInterval(id));}).listen(3000,'0.0.0.0');\n")
    good_proc = launch(good)
    try:
        healthy = command(functions('proposed-test.sh') + f'\nwait_for_app_ready {good_proc.pid}\n', 6)
    finally:
        stop(good_proc)
    slow_proc = launch(slow)
    try:
        old_probe = command(functions('original-test.sh') + '\nprobe_ready\n', 5)
        new_probe = command(functions('proposed-test.sh') + '\nprobe_ready\n', 6)
        new_wait = command(functions('proposed-test.sh') + f'\nwait_for_app_ready {slow_proc.pid}\n', 34)
    finally:
        stop(slow_proc)

results = {
    'source_sha256': {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest()
                      for name in ('original-test.sh', 'proposed-test.sh')},
    'healthy_wait': healthy,
    'old_slow_probe': old_probe,
    'new_slow_probe': new_probe,
    'new_slow_wait': new_wait,
}
results['pass'] = (
    healthy['exit_code'] == 0 and not healthy['timed_out_by_driver'] and
    old_probe['timed_out_by_driver'] and
    new_probe['exit_code'] != 0 and not new_probe['timed_out_by_driver'] and
    new_probe['elapsed_seconds'] <= 4.5 and
    new_wait['exit_code'] != 0 and not new_wait['timed_out_by_driver'] and
    29 <= new_wait['elapsed_seconds'] <= 32
)
(OUTPUT / 'readiness-results.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
raise SystemExit(0 if results['pass'] else 1)

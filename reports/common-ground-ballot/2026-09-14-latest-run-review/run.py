import concurrent.futures
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCES = {
    'gpt': ROOT / 'run-outputs/common-ground-ballot/run-3f3078d2-1170-472e-9eb3-69d32838490d/common-ground-ballot__4Dxb7hd/artifacts/app',
    'oracle': ROOT / 'run-outputs/common-ground-ballot/run-ddac4cac-a16c-408a-bfa2-a774b7e3cf76/common-ground-ballot__WxXEqL4/artifacts/app',
}


def run(kind):
    command = ['docker', 'run', '--rm', '--network', 'none']
    for source, destination, readonly in [(SOURCES[kind], '/submission', True), (OUT, '/results', False)]:
        command += ['--mount', f'type=bind,source={source},target={destination}' + (',readonly' if readonly else '')]
    command += ['common-ground-ballot-tests:1.0.6', 'node', '/results/reproduce.cjs', kind]
    completed = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
    (OUT / f'{kind}-runtime.log').write_text(completed.stdout + '\n' + completed.stderr, encoding='utf-8')
    print(kind, 'exit', completed.returncode, completed.stdout[-12000:], flush=True)
    return completed.returncode


with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    codes = list(pool.map(run, SOURCES))
raise SystemExit(max(codes))

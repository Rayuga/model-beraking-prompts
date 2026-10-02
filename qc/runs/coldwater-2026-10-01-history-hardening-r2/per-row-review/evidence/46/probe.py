"""Read-only row-46 probe of the frozen images and Linux process boundary."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[6]
TASK = ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r2/task"
OUTPUT = Path(__file__).with_name("runtime-probe.json")
AGENT_IMAGE = "qc-coldwater-history:r2"
VERIFIER_IMAGE = "qc-coldwater-row22:history-r2"


def run(args: list[str]) -> dict:
    proc = subprocess.run(args, text=True, capture_output=True, check=False)
    return {
        "command": args,
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def image_id(image: str) -> str:
    result = run(["docker", "image", "inspect", image, "--format", "{{.Id}}"])
    if result["exit_code"]:
        raise RuntimeError(result)
    return result["stdout"].strip()


agent_code = r"""
const fs = require('fs');
const files = ['/tests', '/logs/verifier', '/solution', '/instructions', '/assets', '/app'];
const packages = ['@anthropic-ai/claude-code/package.json', '@openai/codex/package.json', '@playwright/mcp/package.json'];
const found = Object.fromEntries(files.map(p => [p, fs.existsSync(p)]));
const installed = Object.fromEntries(packages.map(p => {try { return [p, require.resolve(p)]; } catch { return [p, null]; }}));
console.log(JSON.stringify({uid: process.getuid(), found, installed, envKeys: Object.keys(process.env).filter(k => /REWARDKIT|ANTHROPIC|OPENROUTER/.test(k))}));
"""

verifier_code = r"""
import hashlib, json, os, stat, subprocess, sys
from pathlib import Path

marker = 'ROW46_PRIVATE_CRITERION_MARKER_20261001'
proc = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(15)', marker])
try:
    nobody_code = r'''
import json, os, sys
from pathlib import Path
pid = sys.argv[1]
out = {'uid': os.geteuid(), 'pid_observed': pid}
for key, path in [('judge_toml', '/tests/scored/functional/judge.toml'), ('root_env', '/proc/' + pid + '/environ'), ('root_argv', '/proc/' + pid + '/cmdline')]:
    try:
        data = Path(path).read_bytes()
        out[key] = {'readable': True, 'marker_visible': b'ROW46_PRIVATE_CRITERION_MARKER_20261001' in data, 'bytes': len(data)}
    except OSError as exc:
        out[key] = {'readable': False, 'error': str(exc)}
print(json.dumps(out))
'''
    probe = subprocess.run(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', sys.executable, '-c', nobody_code, str(proc.pid)], text=True, capture_output=True)
    source = Path('/usr/local/lib/python3.12/site-packages/rewardkit/agents.py')
    caller = Path('/usr/local/lib/python3.12/site-packages/rewardkit/judges.py')
    script = Path('/tests/test.sh')
    output = {
        'image_test_sh_sha256': hashlib.sha256(script.read_bytes()).hexdigest(),
        'tests_file_hashes': {str(p.relative_to('/tests')): hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()},
        'tests_mode': oct(stat.S_IMODE(Path('/tests').stat().st_mode)),
        'agent_source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'judge_source_sha256': hashlib.sha256(caller.read_bytes()).hexdigest(),
        'rewardkit_argv_source': {'agents.py:145-153': source.read_text().splitlines()[144:153], 'judges.py:522-537': caller.read_text().splitlines()[521:537]},
        'nobody_probe': {'exit_code': probe.returncode, 'stdout': probe.stdout, 'stderr': probe.stderr},
    }
    print(json.dumps(output))
finally:
    proc.terminate()
    proc.wait(timeout=3)
"""

if __name__ == "__main__":
    frozen_hash = hashlib.sha256((TASK / "tests/test.sh").read_bytes()).hexdigest()
    frozen_tests_hashes = {str(p.relative_to(TASK / "tests")).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in (TASK / "tests").rglob("*") if p.is_file() and p.name not in {"Dockerfile", ".dockerignore"}}
    agent = run(["docker", "run", "--rm", "--read-only", "--network", "none", "--entrypoint", "node", AGENT_IMAGE, "-e", agent_code])
    verifier = run(["docker", "run", "--rm", "--read-only", "--network", "none", "--entrypoint", "python3", VERIFIER_IMAGE, "-c", verifier_code])
    result = {
        "scope": "Isolated no-network image inspection and Linux /proc permission probe; no RewardKit judge or provider call",
        "frozen_test_sh_sha256": frozen_hash,
        "frozen_tests_file_hashes": frozen_tests_hashes,
        "agent_image": {"name": AGENT_IMAGE, "id": image_id(AGENT_IMAGE), **agent},
        "verifier_image": {"name": VERIFIER_IMAGE, "id": image_id(VERIFIER_IMAGE), **verifier},
    }
    if verifier["exit_code"] == 0:
        image_tests_hashes = json.loads(verifier["stdout"])["tests_file_hashes"]
        result["image_tests_match_frozen"] = image_tests_hashes == frozen_tests_hashes
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(OUTPUT)
    if agent["exit_code"] or verifier["exit_code"]:
        raise SystemExit(1)

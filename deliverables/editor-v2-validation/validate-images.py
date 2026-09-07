"""Build the four task images and run unpaid harness checks. No model calls."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
checks = {}
for product, slug in (("gridforge", "gridforge-spreadsheet-v2"),
                      ("patchpad", "patchpad-editor-v2")):
    task = ROOT / "projects" / slug
    evidence = {}
    for component, directory in (("env", "environment"), ("tests", "tests")):
        name = f"{product}-v2-{component}"
        result = subprocess.run(
            ["docker", "build", "-q", "-t", name, str(task / directory)],
            text=True, capture_output=True, check=True)
        evidence[component + "_image"] = result.stdout.strip()
    code = """
import json, os, subprocess
from pathlib import Path
os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
from rewardkit.runner import discover
criteria = {d.name: len(d.criteria) for d in discover('/tests')}
for script in [*Path('/tests').glob('*.sh'), Path('/solution/solve.sh')]:
    subprocess.run(['bash', '-n', str(script)], check=True)
for script in Path('/solution/app').rglob('*.js'):
    subprocess.run(['node', '--check', str(script)], check=True)
subprocess.run(['bash', '/tests/test.sh'], check=True)
noop = json.loads(Path('/logs/verifier/reward.json').read_text())
assert noop['reward'] == 0 and noop['no_op'] == 1
print(json.dumps({'discovered_criteria': criteria, 'no_op': noop,
                  'shell_and_javascript_syntax': 'passed'}))
"""
    result = subprocess.run(
        ["docker", "run", "--rm", "-i", "--network", "none",
         "--tmpfs", "/app", "--tmpfs", "/logs/verifier",
         "-v", f"{task / 'solution'}:/solution:ro",
         f"{product}-v2-tests", "python3", "-"],
        input=code, text=True, capture_output=True, check=True)
    evidence.update(json.loads(result.stdout.strip().splitlines()[-1]))
    checks[slug] = evidence
    print(slug, "images, RewardKit discovery, syntax and no-op: PASS", flush=True)
(OUT / "image-validation.json").write_text(
    json.dumps(checks, indent=2) + "\n", encoding="utf-8")

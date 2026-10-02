"""No-provider probe of the frozen template's process isolation boundary.

Run through stdin in the existing verifier image with --network none. The
installed RewardKit command builder is real; the CLI process is an inert local
stand-in. No judge, provider request, host credential, or shared container runs.
"""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import tempfile

from rewardkit.agents import ClaudeCodeCLI

result = {
    "rewardkit_version": importlib.metadata.version("harbor-rewardkit"),
    "agents_source_sha256": hashlib.sha256(
        Path("/usr/local/lib/python3.12/site-packages/rewardkit/agents.py").read_bytes()
    ).hexdigest(),
    "network": "none",
    "provider_calls": 0,
    "scope": "Installed command builder plus inert CLI and uid-65534 OS probe; not a configured judge run",
}
with tempfile.TemporaryDirectory(prefix="row46-isolation-") as temp:
    base = Path(temp)
    base.chmod(0o755)
    private = base / "private-tests"
    private.mkdir(mode=0o700)
    (private / "judge.toml").write_text("private criterion marker")
    logs = base / "private-logs"
    logs.mkdir(mode=0o700)
    (logs / "reward.txt").write_text("0.0\n")
    shim = base / "claude"
    shim.write_text("#!/usr/local/bin/python3\nimport time\ntime.sleep(20)\n")
    shim.chmod(0o755)
    prompt = "PRIVATE ROW46 CRITERION: score only the demonstrated application outcome."
    command = ClaudeCodeCLI().build_command(prompt, {"type": "object"})
    result["installed_builder_places_prompt_in_argv"] = command[2] == prompt
    command[0] = str(shim)
    proc = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        probe = r'''
import hashlib,json,os,sys
from pathlib import Path
result={"uid":os.getuid()}
raw=Path("/proc/"+sys.argv[1]+"/cmdline").read_bytes()
parts=raw.split(b"\0")
result["read_root_process_cmdline"]=True
result["full_prompt_recovered"]=any(hashlib.sha256(p).hexdigest()==sys.argv[2] for p in parts)
try:
    Path(sys.argv[3]).read_text()
    result["private_tests_denied"]=False
except PermissionError:
    result["private_tests_denied"]=True
try:
    Path(sys.argv[4]).write_text("1.0\n")
    result["reward_write_denied"]=False
except PermissionError:
    result["reward_write_denied"]=True
result["app_env_has_provider_variables"]=any("TOKEN" in k or "API_KEY" in k for k in os.environ)
print(json.dumps(result,sort_keys=True))
'''
        completed = subprocess.run(
            ["setpriv", "--reuid=65534", "--regid=65534", "--clear-groups", "python3", "-c", probe,
             str(proc.pid), hashlib.sha256(prompt.encode()).hexdigest(), str(private / "judge.toml"), str(logs / "reward.txt")],
            env={"PATH": "/usr/local/bin:/usr/bin:/bin", "NODE_PATH": "/usr/local/lib/node_modules", "HOME": temp, "PORT": "3000", "DB_PATH": str(base / "app.db")},
            text=True, capture_output=True, timeout=10, check=True,
        )
        result["probe"] = json.loads(completed.stdout)
    finally:
        proc.terminate()
        proc.wait(timeout=5)
print(json.dumps(result, indent=2, sort_keys=True))

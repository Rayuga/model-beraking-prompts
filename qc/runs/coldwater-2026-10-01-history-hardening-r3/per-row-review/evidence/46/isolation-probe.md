# Row 46: grader isolation probe

Frozen input SHA256: `80865100dd4b973cb1cfb54e92a812e3f989440975a22dd2519f5f5d5256e841`.

The frozen `environment/Dockerfile` copies only `instructions/` and `assets/` into the agent image (lines 14-15). The agent image inspected as `qc-coldwater-history:r3` had only `.git` and `.gitkeep` under `/app`; a search found no `/tests` or `rewardkit`, and `claude` was absent. The frozen `task.toml` sets `environment_mode = "separate"` (line 28). These observations support pre-submission separation.

The frozen `tests/Dockerfile` installs `harbor-rewardkit==0.1.7` (line 31) and copies the private tests into `/tests` (lines 43-44). The frozen `tests/test.sh` launches the submitted server with UID 65534 via `setpriv` (lines 104-111), then invokes RewardKit in the same container (lines 203-209). The file does not establish a separate PID namespace for the server. `/tests` is mode-restricted, but that does not protect command-line arguments.

Read-only inspection of the already-built `colderwater-verifier:postrepair-audit-20260930` image showed `rewardkit/judges.py` lines 78-88 assemble each private criterion's name and description into a prompt block, line 133 substitutes that block into `{criteria}`, and lines 525-530 pass the prompt to `ClaudeCodeCLI.build_command` and spawn its command. `rewardkit/agents.py` lines 139-154 put it in `['claude', '-p', prompt, '--output-format', 'json', ...]`. The installed `harbor-rewardkit` version was `0.1.7`; calling that method with `private_criterion_marker` yielded `prompt_in_argv True` and `argv_prefix ['claude', '-p', 'private_criterion_marker']`. A separate local probe in the same image started a root-owned Python process with `private_prompt_marker` in its argv; a UID 65534 process read `/proc/<pid>/cmdline` with exit code 0 and `visible_marker True`. It printed `python3 -c import time; time.sleep(5) private_prompt_marker`.

The two targeted commands and outputs were:

```text
docker run --rm --entrypoint python3 colderwater-verifier:postrepair-audit-20260930 -c "import importlib.metadata as m; from rewardkit.agents import ClaudeCodeCLI; c=ClaudeCodeCLI().build_command('private_criterion_marker',{'type':'object'}); print('rewardkit_version',m.version('harbor-rewardkit')); print('prompt_in_argv', 'private_criterion_marker' in c); print('argv_prefix',c[:3])"
rewardkit_version 0.1.7
prompt_in_argv True
argv_prefix ['claude', '-p', 'private_criterion_marker']

docker run --rm --entrypoint python3 colderwater-verifier:postrepair-audit-20260930 -c "import subprocess; p=subprocess.Popen(['python3','-c','import time; time.sleep(5)','private_prompt_marker']); x=subprocess.run(['setpriv','--reuid=65534','--regid=65534','--clear-groups','cat',f'/proc/{p.pid}/cmdline'],capture_output=True); print('exit',x.returncode,'visible_marker',b'private_prompt_marker' in x.stdout,'argv',x.stdout.replace(bytes([0]),b' ').decode(errors='replace')); p.terminate(); p.wait()"
exit 0 visible_marker True argv python3 -c import time; time.sleep(5) private_prompt_marker
```

Together, the frozen runner and the targeted image probe show a credible route for a submitted server to poll `/proc/*/cmdline` during grading and read the assembled private prompt and criteria passed to `claude -p`. That server could tailor its UI or responses to the known checks despite missing general behavior. This is an exposure of criteria during grading, not evidence that the provider key is readable. A fully conforming server does not change the isolation failure. No configured judge, Oracle, target-builder or portal run was performed by this probe.

The supplied raw index's `local-proof-summary.json` hash was rechecked: `cf835729dba5565c7e2748792e2cc94f1881775797ce0b7b96ab2852b80f6438`, matching its index entry. Its line 46 separately says the shared prompt argv/proc exposure remains uncured. That summary corroborates but is not the basis of this finding.

Relevant frozen file hashes: agent Dockerfile `0a75419e9598ded9317b26bbf0d2b12de0b9b11185fb4c9fed1ca7f3e52467d1`; verifier Dockerfile `72998ab8ef0e4225e63b88fccdb754943c54022e25da355035efe7f759a55fdd`; `test.sh` `bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa`; raw index `a31dac94df53b400d3a2db2a9069737beb026d2604066ea3774f1909852dfa92`.

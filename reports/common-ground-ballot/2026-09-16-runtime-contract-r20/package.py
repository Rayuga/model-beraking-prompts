from pathlib import Path
import hashlib
import json
import stat
import subprocess
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT/'projects/common-ground-ballot'
DEST = ROOT/'deliverables/common-ground-ballot/2026-09-16-runtime-contract-r20'
DEST.mkdir(exist_ok=True)
archive = DEST/'common-ground-ballot.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as output:
    for path in sorted(TASK.rglob('*')):
        if not path.is_file(): continue
        info = zipfile.ZipInfo('common-ground-ballot/'+path.relative_to(TASK).as_posix(),(2026,9,16,0,0,0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if path.suffix == '.sh' else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        output.writestr(info,path.read_bytes())
subprocess.run([sys.executable,'-X','utf8',str(HERE/'validate-package.py'),str(archive)],check=True)
sha = hashlib.sha256(archive.read_bytes()).hexdigest()
(DEST/'SHA256SUMS.txt').write_text(sha+'  common-ground-ballot.zip\n',encoding='utf-8')
manifest = {'sha256':sha,'files':{p.relative_to(TASK).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(TASK.rglob('*')) if p.is_file()}}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
runtime = json.loads((HERE/'runtime-smoke/runtime-smoke-results.json').read_text(encoding='utf-8'))
contract = json.loads((HERE/'entrypoint-contract-results.json').read_text(encoding='utf-8'))
checks = json.loads((HERE/'zip-validation.json').read_text(encoding='utf-8'))
assert runtime['failed'] == contract['failed'] == checks['failed'] == 0
report = f'''# Common Ground Ballot r20: runtime contract static-check repair

The latest screenshot shows **44/45 static checks passed**, with
`check-runtime-contract-strings.py` identifying `app-lifecycle.py`,
`prompt-provenance.py`, and `score.py` as verifier-launched application files
missing from the Oracle solution. Later rubric/model/Oracle stages were skipped.
The real app entry is `/app/server.js`, installed by `solution/solve.sh`.
The three reported files are generated private evaluator utilities.

The runner now materializes those utilities as executable commands named
`app-lifecycle`, `prompt-provenance`, and `score`, with explicit
`#!/usr/local/bin/python3` shebangs and mode `700`, and calls their absolute
`/opt/common-ground-verifier/` paths directly. The Functional restart command and
provenance resource hashes use the new paths. Two stale relative `tests/score.py`
references in Polish/Visual prompts were also corrected. Prompt provenance is r20.
No evaluator helper is copied into `/app` or into the golden solution.

The complete golden app, starter/environment, public brief, task.toml, both
Dockerfiles, reward configuration and every judge.toml are byte-identical to r19.
There are still five verifier dimensions and 69 criteria; weights, timeouts,
task version 1.0.0, model and reasoning configuration are unchanged.

| Validation | Result |
| --- | --- |
| Focused entrypoint/delivery regression | {contract['passed']} passed; reproduces all three old filename matches, none in r20 |
| Exact final runner over cached dependencies | {runtime['passed']} passed, two complete runner invocations |
| Source structure/contracts | 259 passed |
| Actual uploaded ZIP bytes/layout | {checks['passed']} passed |

The runner test installs the real golden solution using its solve.sh. In each run
it authenticates against the protected seeded collection, confirms Node runs as
uid65534 from `/app/server.js`, executes the new lifecycle restart command, and
checks unchanged data and the same session afterward. It also checks private
helper executable modes, actual RewardKit discovery of all five dimensions/69
criteria, unchanged genuine Codex version/login delegation, provenance, score
composition and gate-zero behavior. The image is verified byte-for-byte against
the final verifier source before these tests.

The platform static-check script is not available locally; the focused regression
reproduces the reported interpreter/filename classification, not the entire
platform script. A fresh platform QC/Oracle run is required to confirm acceptance.
Runtime checks use the dependency cache already validated in r19; the unchanged
shipped Dockerfile's clean network build previously hit the local corporate proxy.
Synthetic RewardKit scores test plumbing and do not constitute a scored Oracle run.

ZIP: `{DEST.relative_to(ROOT).as_posix()}/common-ground-ballot.zip`.
Files: {len(manifest['files'])}. SHA-256: `{sha}`.
Historical ZIPs, including r19, are unchanged.
'''
(HERE/'README.md').write_text(report,encoding='utf-8',newline='\n')
(DEST/'README.md').write_text(f'''# Common Ground Ballot r20

[Upload common-ground-ballot.zip](common-ground-ballot.zip).

Repairs the static runtime-contract mismatch: private evaluator utilities are
standalone executable commands, while the application entry remains server.js.
Golden app, task requirements, rubric, weights and timeouts are unchanged.

{contract['passed']} focused checks, {runtime['passed']} exact-runner checks and
{checks['passed']} ZIP checks passed. Real golden startup/restart and session/data
survival passed through two runner invocations. Fresh platform QC/Oracle remains
unverified; runtime testing uses cached dependencies.

[Full report](../../../reports/common-ground-ballot/2026-09-16-runtime-contract-r20/README.md).

SHA-256: `{sha}`.
''',encoding='utf-8',newline='\n')
index = ROOT/'deliverables/common-ground-ballot/README.md'
text = index.read_text(encoding='utf-8')
start = text.index('Latest candidate:')
end = text.index("r17's platform Oracle")
text = text[:start] + '''Latest candidate: [common-ground-ballot.zip](2026-09-16-runtime-contract-r20/common-ground-ballot.zip).
**r20 repairs the runtime-contract static check; fresh platform QC/Oracle remains pending.**
Read [the changes and validation](2026-09-16-runtime-contract-r20/README.md).
The exact runner completed twice with the real golden app, protected reads and
session/data persistence through restart. All five dimensions and 69 criteria load.

**r19 is superseded:** the platform classified its private Python helper launches
as application entrypoints and failed one static check (44/45 passed).
**r18 is superseded:** its actual Dockerfile double-installed the Codex wrapper.
Historical ZIP bytes are unchanged.

''' + text[end:]
text = text.replace('| Folder | Contents |\n| --- | --- |','| Folder | Contents |\n| --- | --- |\n| [2026-09-16-runtime-contract-r20](2026-09-16-runtime-contract-r20/) | Current: executable private utilities fix the runtime-contract mismatch; real golden startup/restart tested |')
text = text.replace('Current screenshot-QC repair; explicit brief, stronger starter, reduced repeated grading work, single runtime trace shim and session-integrity coverage','Superseded: 44/45 static checks passed; private Python helpers misclassified as app entrypoints, repaired in r20')
index.write_text(text,encoding='utf-8',newline='\n')
context = ROOT/'TASK_AUTHORING_CONTEXT.md'
text = context.read_text(encoding='utf-8')
entry = f'''## September 16: Common Ground runtime-contract repair r20 (current candidate)

Current ZIP: `{DEST.relative_to(ROOT).as_posix()}/common-ground-ballot.zip`.
SHA-256 `{sha}`. Report: `{HERE.relative_to(ROOT).as_posix()}/README.md`.
r19 screenshot failed one static check (44/45): the platform treated private
Python helper launches as missing application entrypoints. r20 uses executable
private commands under `/opt/common-ground-verifier` with explicit Python shebangs
and mode700; no helper enters `/app` or solution/. Functional restart/provenance and
two stale scorer references are aligned. Golden/brief/environment/rubric/weights/
timeouts are unchanged. Five dimensions, 69 criteria, task version1.0.0.
Local: {contract['passed']} focused contract checks, {runtime['passed']} runner checks
(real golden startup and same-session/data restart twice), {checks['passed']} ZIP checks.
Platform checker source unavailable; no fresh platform QC/Oracle/model score.
Cached dependencies used; the unchanged Dockerfile clean build had local proxy trouble.
Earlier r18 "latest" notes below are historical and include validation gaps later found.

'''
title = '# Current WebDev Task Authoring Context\n\n'
assert text.startswith(title)
context.write_text(title+entry+text[len(title):],encoding='utf-8',newline='\n')
print(json.dumps({'archive':str(archive),'sha256':sha,'files':len(manifest['files']),'runner_checks':runtime['passed'],'contract_checks':contract['passed'],'zip_checks':checks['passed']},indent=2))

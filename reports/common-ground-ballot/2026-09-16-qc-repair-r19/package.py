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
DEST = ROOT/'deliverables/common-ground-ballot/2026-09-16-qc-repair-r19'
DEST.mkdir(exist_ok=True)
archive = DEST/'common-ground-ballot.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for path in sorted(TASK.rglob('*')):
        if not path.is_file(): continue
        name = 'common-ground-ballot/' + path.relative_to(TASK).as_posix()
        info = zipfile.ZipInfo(name, (2026,9,16,0,0,0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if path.suffix == '.sh' else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        output.writestr(info, path.read_bytes())
subprocess.run([sys.executable, '-X', 'utf8', str(HERE/'validate-package.py'), str(archive)],check=True)
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(DEST/'SHA256SUMS.txt').write_text(checksum+'  common-ground-ballot.zip\n',encoding='utf-8')
manifest = {'zip':str(archive.relative_to(ROOT)).replace('\\','/'),'sha256':checksum,
            'files':{p.relative_to(TASK).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(TASK.rglob('*')) if p.is_file()}}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
tests = {
    'Score composition and malformed output': HERE/'score-results.json',
    'Exact runner, actual RewardKit discovery, Codex preservation': HERE/'runtime-smoke/runtime-smoke-results.json',
    'Supplied starter authentication, seed and restart': HERE/'foundation-runtime/foundation-results.json',
    'Golden recovery': HERE/'regression-recovery/recovery-results.json',
    'Golden server boundaries': HERE/'regression-boundaries/strict-boundaries-results.json',
    'Trace wrapper': HERE/'regression-trace/trace-results.json',
    'Session integrity on golden': HERE/'session-golden/mcp-recovery-session-results.json',
    'Session mutant detection and positive controls': HERE/'session-mutant/mcp-recovery-session-results.json',
}
rows = []
total = 0
for name, path in tests.items():
    result = json.loads(path.read_text(encoding='utf-8'))
    assert result['failed'] == 0, (name,result)
    total += result['passed']
    rows.append(f'| {name} | {result["passed"]} | 0 |')
zip_checks = json.loads((HERE/'zip-validation.json').read_text(encoding='utf-8'))
report = f'''# Common Ground Ballot r19 QC repair

The ZIP repairs the seven findings in the latest screenshot. Task version remains
`1.0.0`; all operational template values, judge model/reasoning configuration,
timeouts and final score weights remain unchanged. There are **five serial verifier
dimensions and 69 criteria**: Render 1, Constraints 2, Functional 50, Polish 10,
Visual 6. These are five judge invocations, not 69 separate verifier runs.

| Reported finding | Repair |
| --- | --- |
| Deliverables/runtime contract | Full brief moved to `instruction.md`; explicitly requires shared person/role/group identity in every protected workspace, draft revision 1 and exact +1 accepted transitions. |
| Achievable/unambiguous instructions | Defines ballot and membership revision rules, seed preservation, rejected/replayed revision behavior, and independent session credentials. |
| Timeouts fit the work | Supplies real SQLite schema/transactional seed/authentication and sign-in shell; merges recovery into the Functional prompt; shares staff receipts, refusal fixtures, queue controls, role snapshots and final restart. Original 49 Functional IDs/weights remain. Homogeneous probe tables are bounded and save failures independently. Timeouts are unchanged. |
| Verifier image launch | Removes both Docker-time tracing installations. The runner materializes a private PATH shim outside `/tests`, directly delegates to the untouched installed Codex, and never renames its executable. Exact runner tested twice. |
| Coverage of unpredictable sessions | Adds one independent, publicly specified credential-integrity criterion. Golden rejects eight forged/tampered credential categories; an otherwise working insecure public-ID session mutant is detected. |
| No unrequired grading | Group identity and revision origin/increments are now explicit public requirements matching the verifier and golden app. |
| Task folder only contains allowed files | Removes root test Python/JS helpers, `SCORING.md`, separate recovery prompt and `environment/instructions/`. Runtime helpers are readable heredocs in allowed `test.sh`, generated under `/opt/common-ground-verifier`. Adjacent dimension `prompt.md` files are retained because the detailed `grading_wiring_is_structurally_correct` clause explicitly permits them and pinned RewardKit requires file paths. |

The golden application and seed are byte-for-byte unchanged. The prior reported
failure was in verifier infrastructure/evidence, not a reproduced golden business
defect. The more useful starter still requires all ballot business routes,
eligibility/privacy projections, result math, audit, receipts and browser recovery.
The task remains complex; this package does not predict a new GPT score.

| Local validation | Passed | Failed |
| --- | ---: | ---: |
{chr(10).join(rows)}
| **Runtime/regression groups total** | **{total}** | **0** |
| Source contract/layout checks | 259 | 0 |
| Actual ZIP checks | {zip_checks['passed']} | 0 |

The runtime image was checked to contain the exact final verifier source bytes.
Actual RewardKit discovery found exactly five dimensions and loaded 69 criteria;
no helper module was discovered as a reward. Synthetic scores test runner plumbing,
not application quality. Golden business/browser checks used the unchanged reference
app; session-forgery checks used the pinned Playwright MCP.

**Verification limits:** two builds of the actual shipped Dockerfile reached APT
but failed because the local Docker network routed through an unresolved corporate
proxy. Clearing standard proxy build arguments did not fix that external setting.
Runtime checks therefore used an explicitly labelled cached-dependency validation
image, restoring the genuine npm Codex executable and applying the final `/tests`
files. This does not establish a clean network image build. A fresh platform QC,
Oracle and model run are still required; no new Oracle/GPT score or measured
end-to-end grading speedup is claimed. The workload matrix measures reduced work
and text, not autonomous judge duration.

Historical r18 is superseded: its actual Dockerfile installed the wrapper twice.
Earlier cached-image tests did not exercise that installation sequence.

ZIP: `common-ground-ballot.zip` ({len(manifest['files'])} files under one task wrapper).
SHA-256: `{checksum}`.
'''
(HERE/'README.md').write_text(report,encoding='utf-8',newline='\n')
release = f'''# Common Ground Ballot r19

Upload [common-ground-ballot.zip](common-ground-ballot.zip).

Repairs the seven screenshot findings: explicit requirements, a practical starter,
less repeated grading work, safe Codex tracing, forged-session coverage and the
allowed task layout. Golden app/seed unchanged; five verifiers, 69 criteria.

{total} local regression/runtime groups and {zip_checks['passed']} ZIP checks passed.
The exact runner was tested twice, including real RewardKit discovery and Codex
delegation. See [the full report](../../../reports/common-ground-ballot/2026-09-16-qc-repair-r19/README.md).

Clean Docker build was blocked by the local corporate proxy; runtime testing used
cached dependencies. Fresh platform QC/Oracle/model scores remain unverified.

SHA-256: `{checksum}`.
'''
(DEST/'README.md').write_text(release,encoding='utf-8',newline='\n')
index = ROOT/'deliverables/common-ground-ballot/README.md'
text = index.read_text(encoding='utf-8')
start = text.index('Latest candidate:')
end = text.index('r17\'s platform Oracle')
text = text[:start] + '''Latest candidate: [common-ground-ballot.zip](2026-09-16-qc-repair-r19/common-ground-ballot.zip).
**r19 repairs the seven screenshot findings; fresh platform QC/Oracle remains pending.**
Read [the changes and validation](2026-09-16-qc-repair-r19/README.md).
The exact runner completed twice with genuine Codex preserved and all five dimensions
discovered. Golden recovery and boundary checks passed. Clean image build remains
blocked by the local corporate proxy; runtime tests used cached dependencies.

**r18 is superseded:** its shipped Dockerfile double-installed the trace wrapper;
its earlier local cached-image checks did not cover that installation sequence.
Historical ZIP bytes are unchanged.

''' + text[end:]
text = text.replace('| Folder | Contents |\n| --- | --- |', '| Folder | Contents |\n| --- | --- |\n| [2026-09-16-qc-repair-r19](2026-09-16-qc-repair-r19/) | Current screenshot-QC repair; explicit brief, stronger starter, reduced repeated grading work, single runtime trace shim and session-integrity coverage |')
text = text.replace('Four-phase workflow, one comprehensive restart, bounded evidence helper and judge traces; 132 local groups pass; fresh scored Oracle pending', 'Superseded: seven screenshot-QC findings, including double wrapper installation in the actual Dockerfile; repaired in r19')
index.write_text(text,encoding='utf-8',newline='\n')
print(json.dumps({'archive':str(archive),'sha256':checksum,'files':len(manifest['files']),'local_test_groups':total,'zip_checks':zip_checks['passed']},indent=2))

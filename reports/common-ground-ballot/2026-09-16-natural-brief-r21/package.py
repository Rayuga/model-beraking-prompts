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
DEST = ROOT/'deliverables/common-ground-ballot/2026-09-16-natural-brief-r21'
OLD = ROOT/'deliverables/common-ground-ballot/2026-09-16-runtime-contract-r20/common-ground-ballot.zip'
DEST.mkdir(exist_ok=True)
files = {p.relative_to(TASK).as_posix():p.read_bytes() for p in sorted(TASK.rglob('*')) if p.is_file()}
with zipfile.ZipFile(OLD) as old:
    baseline = {name.split('/',1)[1]:old.read(name) for name in old.namelist()}
assert files.keys() == baseline.keys(), 'No task file may be added or removed in this editorial repair'
changed = [name for name in files if files[name] != baseline[name]]
assert changed == ['instruction.md'], changed
brief_sha = hashlib.sha256(files['instruction.md']).hexdigest()
report = {'compared_to':str(OLD.relative_to(ROOT)).replace('\\','/'),
          'changed_files':changed,'unchanged_files':len(files)-1,'instruction_sha256':brief_sha,
          'golden_unchanged':True,'verifiers_unchanged':True,'environment_unchanged':True,
          'task_config_unchanged':True,'scored_oracle':False}
(HERE/'change-scope.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
archive = DEST/'common-ground-ballot.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as output:
    for name,data in files.items():
        info = zipfile.ZipInfo('common-ground-ballot/'+name,(2026,9,16,0,0,0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.sh') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        output.writestr(info,data)
subprocess.run([sys.executable,'-X','utf8',str(HERE/'validate-package.py'),str(archive)],check=True)
sha = hashlib.sha256(archive.read_bytes()).hexdigest()
(DEST/'SHA256SUMS.txt').write_text(sha+'  common-ground-ballot.zip\n',encoding='utf-8')
(DEST/'manifest.json').write_text(json.dumps({'sha256':sha,'files':{name:hashlib.sha256(data).hexdigest() for name,data in files.items()}},indent=2)+'\n',encoding='utf-8')
checks = json.loads((HERE/'zip-validation.json').read_text(encoding='utf-8'))
text = f'''# Common Ground Ballot r21: natural product brief

The latest screenshot reports **45/45 static checks passed** and **51/53
rubric checks passed**. The two remaining findings are
`instruction_is_a_natural_product_request` and
`instruction_preserves_natural_human_voice`. Model and Oracle stages were skipped.

This repair changes only `instruction.md`. It now reads as an association member's
request: the people and practical needs come first, with open tabs, privacy and
lost responses explaining the detailed behavior. The formal specification
headings, demo-account table, opening build recipe and runtime checklist are gone.
Hosting details remain near the end as setup context. Technical requirements
remain explicit where ambiguity previously caused QC failures.

The coverage review checks the original product requirements, including revision
1/+1 rules, all roles/workspaces, snapshots, both ballot methods and result math,
typed input boundaries, anonymous selections, session integrity/revocation,
operation receipt status/body and namespaces, rejected-operation persistence,
pending actions before send, account/tab isolation, retry/dismissal behavior,
accessibility and the complete runtime contract. The wording clarifies the
Approval selection limit, associated labels and required stack. SEED_PATH is
explicitly a startup override; the delivered app still includes its seed.
Post-submit confirmation privacy does not prohibit pre-submit selection review.

The independent editorial reviews are recorded in `coverage-review.md` and
`voice-review.md`. These are local reviews, not platform QC verdicts.

| Validation | Result |
| --- | --- |
| Exact comparison with delivered r20 ZIP | Only instruction.md changed; all other {len(files)-1} files byte-identical |
| Source contract/layout checks | 259 passed |
| Actual ZIP contract/layout checks | {checks['passed']} passed |
| Runtime/Oracle/model rerun | Not run for this prose-only change |

The golden solution, all five verifiers and their 69 criteria, score weights,
timeouts, model configuration, task version1.0.0, starter, seed and Dockerfiles
are unchanged. Verifier prompt versions remain r20 because those files have not
changed. The prior r20 local tests exercised the real golden app and exact runner
twice; they are historical evidence, not newly executed r21 tests.

A fresh platform QC run is needed to confirm that both voice findings clear.
No new Oracle/model score or guaranteed 53/53 result is claimed. The earlier
clean Docker build limitation remains: local testing used cached dependencies
after the corporate proxy prevented package downloads.

ZIP: `{DEST.relative_to(ROOT).as_posix()}/common-ground-ballot.zip`.
Files: {len(files)}. SHA-256: `{sha}`.
Instruction SHA-256: `{brief_sha}`.
All historical ZIP bytes are preserved.
'''
(HERE/'README.md').write_text(text,encoding='utf-8',newline='\n')
(DEST/'README.md').write_text(f'''# Common Ground Ballot r21

[Upload common-ground-ballot.zip](common-ground-ballot.zip).

Rewrites the brief as a natural product request to address the two remaining
voice findings. Only instruction.md changed; the other {len(files)-1} files,
including the golden solution and every verifier, are byte-identical to r20.

{checks['passed']} ZIP checks passed. Fresh platform QC is still required;
no new Oracle/model run was performed for this editorial change.

[Full report](../../../reports/common-ground-ballot/2026-09-16-natural-brief-r21/README.md).

SHA-256: `{sha}`.
''',encoding='utf-8',newline='\n')
index = ROOT/'deliverables/common-ground-ballot/README.md'
content = index.read_text(encoding='utf-8')
start = content.index('Latest candidate:')
end = content.index("r17's platform Oracle")
content = content[:start] + '''Latest candidate: [common-ground-ballot.zip](2026-09-16-natural-brief-r21/common-ground-ballot.zip).
**r21 addresses the two remaining brief-voice findings; fresh platform QC is pending.**
Read [the changes and validation](2026-09-16-natural-brief-r21/README.md).
Only instruction.md changed; the golden app, all verifiers and runtime are identical to r20.

The latest screenshot for r20 reports static45/45 and rubric51/53; its two failures
concern natural product-request voice. Oracle/model runs were skipped.
r19 is historical (44/45 static; private helpers misclassified as app entrypoints).
r18 is historical (double Codex-wrapper installation in its actual Dockerfile).
Historical ZIP bytes remain unchanged.

''' + content[end:]
content = content.replace('| Folder | Contents |\n| --- | --- |','| Folder | Contents |\n| --- | --- |\n| [2026-09-16-natural-brief-r21](2026-09-16-natural-brief-r21/) | Current: natural product request; only instruction.md changed, all requirements retained |')
content = content.replace('Current: executable private utilities fix the runtime-contract mismatch; real golden startup/restart tested','Static45/45, rubric51/53 in supplied screenshot; two remaining brief-voice findings addressed in r21')
index.write_text(content,encoding='utf-8',newline='\n')
context = ROOT/'TASK_AUTHORING_CONTEXT.md'
content = context.read_text(encoding='utf-8')
title = '# Current WebDev Task Authoring Context\n\n'
assert content.startswith(title)
entry = f'''## September 16: Common Ground natural brief r21 (current candidate)

Current ZIP: `{DEST.relative_to(ROOT).as_posix()}/common-ground-ballot.zip`.
SHA-256 `{sha}`. Report: `{HERE.relative_to(ROOT).as_posix()}/README.md`.
Latest user screenshot reports static45/45 and rubric51/53, failing only natural
product-request voice and natural human voice. Model/Oracle skipped. r21 rewrites
ONLY instruction.md as a conversational product-owner ask and retains precise
business/runtime constraints. All other28taskfiles are byte-identical to r20,
including golden, environment, taskconfig and every verifier. No runtime/model
tests rerun for this prose-only edit. Source259 andZIP{checks['passed']}checks pass.
Independent coverage and voice reviews are in the report directory. Fresh
platformQC/Oracle/model results remain unverified. Earlier candidate notes below
are historical; current verifiers still have r20prompt versions unchanged.

'''
context.write_text(title+entry+content[len(title):],encoding='utf-8',newline='\n')
print(json.dumps({'archive':str(archive),'sha256':sha,'changed_files':changed,'unchanged_files':len(files)-1,'zip_checks':checks['passed']},indent=2))

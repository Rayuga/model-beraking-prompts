"""Apply supplied DOCX guidance locally; never change task/delivery/run evidence."""
import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile
from collections import Counter
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/gridforge-spreadsheet-v2'

def sha(b):
    return hashlib.sha256(b).hexdigest()

documents = []
for name in ('Task QC - platform.docx', 'upload-checks-README.md.docx'):
    path = ROOT / name
    doc = Document(path)
    blocks = []
    for el in doc.element.body.iterchildren():
        if el.tag.endswith('}p'):
            blocks.append(Paragraph(el, doc).text)
        elif el.tag.endswith('}tbl'):
            blocks.extend(' | '.join(c.text for c in row.cells) for row in Table(el, doc).rows)
    documents.append({'file': name, 'sha256': sha(path.read_bytes()), 'text': '\n'.join(blocks)})
criteria = tomllib.loads(documents[0]['text'])['criteria']
assert len(criteria) == 19
upload_ids = re.findall(r'^(check-[a-z-]+) — ', documents[1]['text'], re.M)
assert len(upload_ids) == 26 and len(set(upload_ids)) == 26

# Local, source-only interpretation of all nineteen supplied criteria.
reviews = [
 ('REVIEW', 'A2: task.toml provenance describes a v2 restructuring, not a traceable arena/product log. No original real-traffic source is established by the packaged files; do not invent provenance.'),
 ('REVIEW', 'A3: the brief is natural first-person product prose, but the original source is unavailable, so preservation of original typos/terseness cannot be verified. Clean prose alone does not prove model generation.'),
 ('FAIL', 'A6: F03/F05 in the main report identify mandatory redundant identity fields and initial Find Next ordering not fixed by the brief. Source inspection alone establishes these alternate reasonable readings.'),
 ('REVIEW', 'B1: broad coverage exists, including a restart criterion and manifest-route criterion. Exhaustive clause-by-clause completeness is not proven; the DOCX demands a complete requirement/assertion matrix, not just feature-family coverage.'),
 ('PASS', 'B3: all four prompts require the live localhost workbook and a same-origin data response. test.sh probes readiness before RewardKit; tests are not string-only.'),
 ('PASS', 'B4: written range/multi-formula checks enumerate every cell/result; restart and rejection checks compare complete saved collections. No first-match-only projection found. This is a source assessment, not proof the judge executed every row.'),
 ('PASS', 'C4: seed raw cells are strings; numeric display equivalence is explicit. Seed title, identities, anchors and baseline formulas match. F03 separately concerns requiring a redundant field, not a seed type mismatch.'),
 ('PASS', 'C5: all TOML criteria and prompts parse, {criteria} is present, and checks are executable browser/API descriptions, not malformed JSONPath. No syntactically dead assertion found; semantic fairness remains separately flagged.'),
 ('REVIEW', 'C6: each prompt has {criteria}, and credentials use ${OPENROUTER_API_KEY}, not a secret. The template substitution is declared; platform secret/resolver injection cannot be proven from task source alone.'),
 ('PASS', 'C7: server rejection probes demand exact deep equality of workbook and revision lists after every rejection; restart covers complete saved snapshots; local edit checks name outside controls.'),
 ('PASS', 'C8: restart explicitly excludes transient presence/session fields; persistence checks compare stored workbook/history, not whole browser state. Preview and restore specify when draft changes are legitimate and stored content must not change.'),
 ('PASS', 'C9: shipped seed facts and formula arithmetic agree (B2=3, C2=120, D2=360; named anchors and workbook title). Source scoring uses a gated 60/40 split. See existing literal/arithmetic audit; no historical reward used as source proof.'),
 ('PASS', 'D2: test.sh hard-zeros final reward if either Render or Constraints is below 1; their epsilon metadata weights are excluded from final quality arithmetic. Polish also requires persisted server-backed editing.'),
 ('N/A', 'D5: no prose-length deliverable or measured verbosity reward is requested. Extra output length earns no criterion credit; this does not warrant inventing a text-length restriction on a spreadsheet.'),
 ('PASS', 'E2: solution and seed are static, source-versioned files; release 2.0.10 and unchanged prompt revision 2.0.9 are explicit. Current report records source/ZIP hashes. No regenerated baseline is used by the runner.'),
 ('POLICY CONFLICT', 'E3: verifier network_mode is public, not offline or allowlisted. Packages are baked and test.sh does not download trial tooling; model judging still uses OpenRouter. Public mode follows explicit user/lead direction but is not literal compliance with this DOCX criterion.'),
 ('PASS', 'E4: every judge declares openai/gpt-5.6-luna, temperature 0 and high effort with matching versioned prompts. Explicit model naming does not guarantee a provider never updates internals or eliminate LLM variance.'),
 ('REVIEW', 'F2: all prompts explicitly distrust submission content, but the DOCX additionally says tested with an injected directive. No such adversarial test was performed. That empirical clause is not source-decidable despite the document header.'),
 ('PASS', 'F3: separate verifier, tests copied only into tests/Dockerfile, no solution/tests COPY in agent Dockerfile. This is the declared isolation design, not a live penetration-test claim.'),
]
assert len(reviews) == len(criteria)
source_rows = [dict(id=c['name'], description=c['description'], guidance=c['guidance'], status=s, evidence=reason)
               for c, (s, reason) in zip(criteria, reviews)]

upload_review = {
 'check-task-timeout': ('PASS', 'Agent 7200s and verifier 12600s are positive and below 18000s each; build 1800 + agent 7200 + verifier 12600 = 21600s, exactly the documented total cap. No cap headroom; live project caps/age policy must agree.'),
 'check-sandbox-resources': ('PASS', 'Agent 2 CPUs, 4096 MB RAM/disk fit documented 4 CPU, 8 GiB RAM, 10 GiB disk defaults; no GPU request.'),
 'check-dockerfile-references': ('PASS', 'Agent image copies assets/instructions only, never solution or tests.'),
 'check-network-mode': ('POLICY DEPENDENT', 'Both modes are public and match the guide default required_mode=public and user direction. Actual project overrides are not available; this is not a universal no-network rule.'),
 'check-allowed-hosts': ('N/A', 'Neither phase uses allowlist, so an allowed_hosts declaration is not required by this rule.'),
 'check-gpu-types': ('N/A', 'No GPU requested.'),
 'check-dockerfile-platform': ('PASS', 'No FROM --platform pin.'),
 'check-compose-host-binds': ('N/A', 'No Compose file in the task archive.'),
 'check-base-image-pinned': ('PASS', 'Both Node and Python external FROM images use tags plus sha256 digests; the node-runtime stage reference is local.'),
 'check-nproc': ('PASS', 'No bare nproc in task shell scripts or Dockerfiles.'),
 'check-pip-pinning': ('PASS', 'The sole pip install pins pyyaml 6.0.2, openai 2.30.0, python-dotenv 1.0.1 and harbor-rewardkit 0.1.7 with ==; no uvx/tool trial install.'),
 'check-dockerfile-sanity': ('PASS', 'Apt packages are not version-pinned; apt-get update and list cleanup are present. Do not reintroduce apt version pins to satisfy generic dependency-pinning language.'),
 'check-pytest-version': ('N/A', 'No pytest or pytest-json-ctrf install; the runner is RewardKit.'),
 'check-trial-network-fetch': ('PASS', 'test.sh uses curl only for localhost readiness. No curl-to-shell, wget or git clone; judge tools are not downloaded at trial time.'),
 'check-canary': ('OFF BY DEFAULT', 'Guide has blank canary configuration. No configured project canary was supplied; cannot certify an enabled custom rule.'),
 'check-task-fields': ('OFF BY DEFAULT', 'Guide default required_fields includes persona, which GridForge omits. It has category Software, subcategory and difficulty/solution explanations. Would need attention if that optional rule is enabled; do not add persona blindly because newer WebDev guidance rejects template residue.'),
 'check-task-slug': ('PASS', 'gridforge-spreadsheet-v2 is kebab-case with 3 tokens, below the guide default 8 and within the user 3-token rule.'),
 'check-task-version': ('PASS', 'Optional/off by default; [task].version is valid semver 2.0.10.'),
 'check-task-package-name': ('PASS', 'turing/gridforge-spreadsheet-v2 equals default org plus exact folder.'),
 'check-instruction-suffix': ('OFF BY DEFAULT', 'Blank default suffix template; unknown custom project sentence cannot be checked.'),
 'check-task-absolute-path': ('OFF BY DEFAULT', 'Runtime roots /app, /instructions and /assets are absolute; filenames under those explained roots are relative in prose. Any enabled literal path checker needs its implementation/policy.'),
 'check-test-file-references': ('REVIEW', 'instruction.md names /app, package.json, APP_MANIFEST.md and seed. The actual SQLite filename is intentionally manifest-discovered rather than fixed; golden uses /app/data/gridforge.db. The supplied guide does not define how its static intersection scanner treats this legitimate dynamic contract.'),
 'check-test-sh-sanity': ('N/A', 'Guide applies to shared verifiers; this task uses separate mode.'),
 'check-verifier-tooling-baked': ('PASS / POLICY CONFLICT', 'Current tests/Dockerfile bakes Codex, Playwright MCP, Chromium and RewardKit, matching this supplied upload rule. It contradicts the newer lead request not to install Harbor-supplied tools. Need authoritative current template/platform behavior before changing a working runner.'),
 'check-artifact-paths': ('PASS', 'Top-level artifacts are absolute /app and /logs/verifier; no .., explicit destination collision, reserved manifest.json destination or sidecar entry. Source-form review only, not Harbor loader execution.'),
 'check-separate-verifier': ('REVIEW / OFF BY DEFAULT', 'Separate mode, top-level artifacts and COPY . /tests are present. tests/Dockerfile does not explicitly mkdir /app and /logs/verifier artifact parents; test.sh creates logs at runtime. The documented optional strict image rule may require image-time parent creation if enabled.'),
}
assert set(upload_review) == set(upload_ids)
upload_rows = [dict(id=k, status=upload_review[k][0], evidence=upload_review[k][1]) for k in upload_ids]

# Fresh analogous local checks. These are not calls to platform checker implementations.
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
t = tomllib.loads(files['task.toml'].decode())
agent = files['environment/Dockerfile'].decode()
verifier = files['tests/Dockerfile'].decode()
runner = files['tests/test.sh'].decode()
shells = '\n'.join(b.decode() for n,b in files.items() if n.endswith('.sh') or n.endswith('Dockerfile'))
checks = []
def check(name, ok, evidence):
    checks.append(dict(check=name, status='PASS' if ok else 'FAIL', evidence=evidence))
check('Document inventories', len(criteria)==19 and len(upload_ids)==26, 'Parsed all 19 source criteria and 26 upload IDs from DOCX text/tables.')
check('Phase timeout cap', all(0 < t[s]['timeout_sec'] <= 18000 for s in ['agent','verifier']), 'Document defaults, not fetched platform policy.')
check('Total timeout cap', t['agent']['timeout_sec']+t['verifier']['timeout_sec']+t['environment']['build_timeout_sec'] <= 21600, '21600 seconds exactly.')
check('Resource defaults', t['environment']['cpus']<=4 and t['environment']['memory_mb']<=8192 and t['environment']['storage_mb']<=10240, 'No GPU requested.')
check('Public in both phases', t['environment']['network_mode']==t['verifier']['environment']['network_mode']=='public', 'Preserved; no configuration changes.')
check('Separate verifier', t['verifier']['environment_mode']=='separate', 'Declared in task.toml.')
check('Name and wrapper', t['task']['name']=='turing/'+TASK.name and len(TASK.name.split('-'))==3, t['task']['name'])
check('No architecture pin', not re.search(r'^FROM\s+--platform', agent+'\n'+verifier, re.M), 'Both Dockerfiles inspected.')
check('No agent solution/test copies', not re.search(r'^(?:COPY|ADD)\s+.*(?:solution|tests)',agent,re.M|re.I), 'Agent COPY assets and instructions only.')
check('No bare nproc', not re.search(r'\bnproc\b',shells), 'Task shell scripts and Dockerfiles.')
check('No trial download installers', not re.search(r'\b(?:wget|git\s+clone|pip3?\s+install|npm\s+install)\b',runner), 'Readiness curl is localhost only; tools baked in image.')
check('Readiness precedes grading', runner.index('for attempt in $(seq 1 30)') < runner.index('rewardkit --max-concurrent-agent'), 'Bounded HTTP readiness loop.')
check('Explicit hard gate', 'data["render"] < 1.0 or data["constraints"] < 1.0' in runner, 'Final formula hard-zeros gate failure.')
for dim in ('render','constraints','functional','polish'):
    d=tomllib.loads(files[f'tests/{dim}/judge.toml'].decode())['judge']
    p=files[f'tests/{dim}/prompt.md'].decode()
    check(dim+' judge contract', d['model']=='openai/gpt-5.6-luna' and d['temperature']==0 and d['reasoning_effort']=='high' and '{criteria}' in p and 'untrusted' in p, 'Model/temperature/effort, criteria interpolation and distrust instructions; not an adversarial test.')
zip_path=ROOT/'deliverables/gridforge/final-deliverables/gridforge-spreadsheet-v2.zip'
with zipfile.ZipFile(zip_path) as z:
    names=[i.filename for i in z.infolist() if not i.is_dir()]
    check('Archive source hashes unchanged', len(names)==len(files) and set(names)=={TASK.name+'/'+n for n in files} and all(z.read(TASK.name+'/'+n)==b for n,b in files.items()), 'All 32 entries exactly match current source bytes.')
    check('Archive CRC', z.testzip() is None, 'Existing final ZIP; not repackaged.')
baseline=json.loads((OUT/'evidence.json').read_text())
check('Same reviewed ZIP', sha(zip_path.read_bytes())==baseline['zip_sha256'], sha(zip_path.read_bytes()))
result={'documents':documents,'source_rows':source_rows,'upload_rows':upload_rows,'local_checks':checks,'zip_sha256':sha(zip_path.read_bytes())}
(OUT/'docx-review.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

lines=['# GridForge 2.0.10 — supplied DOCX review','',
 'Reviewed 10 September 2026. Local document-based assessment, not an official platform pass. No task source, frozen final delivery or recorded score was changed. No paid run was started.','',
 '## What these documents mean','',
 '`Task QC - platform.docx` defines 19 source-decidable criteria, excluding 11 measurement/run-dependent scorecard rows. It explicitly says flat pass/fail, not a weighted score. It is distinct from the 53-row WebDev review. Its own note says the source scorecard self-labels 34 but contains 30 rows; do not invent a 34-row grade.','',
 '`upload-checks-README.md.docx` defines 26 Rules-stage checks. An error stops later stages; warning/off does not. Most severities/configuration are project-configurable, and three correctness checks are locked. We have the document defaults, not live project settings or the official checker implementations. No policy-changing API request was made.','',
 'Statuses below are local evidence labels. REVIEW, N/A, POLICY CONFLICT and OFF BY DEFAULT are not platform PASS values. Source-only reviews are kept separate from existing run evidence.','',
 '## Important qualifications','',
 '- Public networking matches the upload guide default and explicit user direction, but conflicts with older source-QC E3 offline/allowlist wording. Do not silently claim both policies pass.',
 '- Current baked judge tooling matches check-verifier-tooling-baked, while the newer lead says Harbor provides it. This confirms a documentation/template policy conflict; verify the current separate-verifier tool contract before deleting dependencies.',
 '- Optional metadata defaults request persona while newer WebDev guidance rejects borrowed persona metadata. The optional rule is off in the supplied defaults; do not reintroduce it blindly.',
 '- The total timeout is exactly the documented six-hour cap. It satisfies the numeric inequality but provides no cap margin if live sandbox accounting differs.',
 '- The brief does not establish real-traffic provenance or preservation of an original prompt. The injection defense exists as text, but the DOCX additionally requests a tested injection; none was performed.',
 '- Previously reported golden keyboard and verifier-fairness findings remain. The source-QC ambiguity failure is supported by instructions/verifier inspection; the measured keyboard failure remains post-run evidence, not evidence available to a source-only platform judge.','',
 '## Source document fingerprints','']
for d in documents: lines.append(f"- `{d['file']}` SHA-256 `{d['sha256']}`")
for heading,rows in [('19 source-review criteria',source_rows),('26 upload-rule reviews',upload_rows)]:
    lines.extend(['','## '+heading,''])
    for row in rows:
        lines.extend(['### '+row['id'],'',row['status']+' — '+row['evidence'],''])
lines.extend(['## Fresh local checks','',f"{len(checks)} analogous local assertions: {sum(c['status']=='PASS' for c in checks)} passed. These are not the 26 platform scripts.",''])
for c in checks: lines.append(f"- {c['status']}: {c['check']} — {c['evidence']}")
lines.extend(['','Not run: official upload/static/source-QC stages; live-policy lookup; new image build; fresh Oracle/model run; adversarial prompt injection; exhaustive requirement-to-assertion proof. The prior local browser diagnostic is documented separately in the main report.','', 'ZIP SHA-256 remains `'+result['zip_sha256']+'`.',''])
(OUT/'DOCX-QC-UPLOAD-REVIEW.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'source_rows':len(source_rows),'upload_rows':len(upload_rows),'local_checks':len(checks),'passed':sum(c['status']=='PASS' for c in checks),'source_status_counts':dict(Counter(r['status'] for r in source_rows))}))

"""Independent read-only release rebinding; does not run containers or judges."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import stat
import tomllib
import zipfile

HERE = Path(__file__).resolve().parent
DELIVERY = HERE.parent
ROOT = HERE.parents[3]
TASK = ROOT/'projects/colderwater-playground-devtools'
ARCHIVE = DELIVERY/'colderwater-playground-devtools.zip'
EXPECTED = '63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64'
PREFIX = 'colderwater-playground-devtools/'
sha = lambda b: hashlib.sha256(b).hexdigest()
checks = []
def check(name, ok, evidence=None):
    checks.append({'name': name, 'passed': bool(ok), 'evidence': evidence})
manifest = json.loads((DELIVERY/'candidate_manifest.json').read_text())
check('Requested candidate SHA-256', sha(ARCHIVE.read_bytes()) == EXPECTED, sha(ARCHIVE.read_bytes()))
check('Manifest archive identity and length', manifest['sha256'] == EXPECTED and manifest['bytes'] == ARCHIVE.stat().st_size)
with zipfile.ZipFile(ARCHIVE) as z:
    check('CRC', z.testzip() is None)
    names = z.namelist()
    check('One root and no duplicate or traversing entries', len(set(names)) == len(names) and all(n.startswith(PREFIX) and '..' not in PurePosixPath(n).parts and not PurePosixPath(n).is_absolute() for n in names))
    entries = {n[len(PREFIX):]: z.read(n) for n in names if not n.endswith('/')}
    check('Manifest covers exact archive file set', set(entries) == set(manifest['source_sha256']) and len(entries) == manifest['files'] == 50)
    mismatch = [n for n,b in entries.items() if sha(b) != manifest['source_sha256'].get(n)]
    check('All 50 archive hashes match manifest', not mismatch, mismatch)
    mismatch = [n for n,b in entries.items() if not (TASK/n).is_file() or b != (TASK/n).read_bytes()]
    check('All 50 archive files match current source bytes', not mismatch, mismatch)
    hazards = [i.filename for i in z.infolist() if stat.S_ISLNK(i.external_attr >> 16) or any(x in PurePosixPath(i.filename).parts for x in ['node_modules','.git','__pycache__']) or PurePosixPath(i.filename).suffix in ['.db','.zip','.xlsx','.pyc']]
    check('No archive transient files or symlinks', not hazards, hazards)
    check('Shell executable modes and Unix lines', all(z.getinfo(PREFIX+n).external_attr >> 16 & 0o111 and b'\r' not in entries[n] for n in ['tests/test.sh','solution/solve.sh']))

old_path = ROOT/'deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/colderwater-playground-devtools.zip'
with zipfile.ZipFile(old_path) as old:
    changed = [n for n,b in entries.items() if b != old.read(PREFIX+n)]
    check('Only approved four verifier files differ from a017', set(changed) == {'tests/test.sh','tests/app_context.md','tests/scored/functional/judge.toml','tests/scored/functional/prompt.md'}, changed)
    for rel in ['tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml','task.toml','tests/Dockerfile','environment/Dockerfile']:
        check('Unchanged configuration/helper: '+rel, entries[rel] == old.read(PREFIX+rel), sha(entries[rel]))
    def schema(spec):
        return {'judge': spec['judge'], 'scoring': spec['scoring'], 'criterion': [{k:v for k,v in c.items() if k != 'description'} for c in spec['criterion']]}
    for rel in [n for n in entries if n.endswith('/judge.toml')]:
        check('Unchanged RewardKit schema/order/weights: '+rel, schema(tomllib.loads(entries[rel].decode())) == schema(tomllib.loads(old.read(PREFIX+rel).decode())))
for rel in ['tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml']:
    check('Matches current canonical template: '+rel, entries[rel] == (ROOT/'projects/webdev-task-template'/rel).read_bytes())
semantic = {'tests/scored/functional/judge.toml':'ebdd280b66d66fc87933dc688fa706dbe6793e89d275b1be671ca745af05c97c', 'tests/scored/functional/prompt.md':'2da857000735a4e7d5ad00ba29adbbeb8b5cbb6a881a5ee9df11fec71af5624e', 'tests/app_context.md':'ae175bceca880cce3273866664aeaf631b77684926106fa6fc1cd069c02e31fb'}
for rel, expected in semantic.items():
    check('Frozen semantic file read in full: '+rel, sha(entries[rel]) == expected, {'sha256':sha(entries[rel]), 'lines':len(entries[rel].decode().splitlines())})
shell_hash = sha(entries['tests/test.sh'])
for filename, count in [('actual_rewardkit_results.after.json',10),('guard_probe_results.json',43),('harness_regression_results.json',4)]:
    proof = json.loads((HERE/filename).read_text())
    rows = proof.get('cases', proof.get('results'))
    check('Exact released shell rebind: '+filename, proof['test_sh_sha256'] == shell_hash and len(rows) == count and proof.get('passed',True), {'sha256':shell_hash,'cases':count,'evidence_sha256':sha((HERE/filename).read_bytes())})
binding = json.loads((HERE/'review_binding.json').read_text())
check('Prior 39-point compatibility binding still applies', binding['passed'] and binding['patched_shell_sha256'] == shell_hash)
specs = {PurePosixPath(n).parent.name: tomllib.loads(b.decode()) for n,b in entries.items() if n.endswith('/judge.toml')}
check('35 functional / 47 total criteria', len(specs['functional']['criterion']) == 35 and sum(len(s['criterion']) for s in specs.values()) == 47)
order = [c['id'] for c in specs['functional']['criterion']]
check('Restart still position 22', order[20:22] == ['save_load','cw_process_restart_durability'])
image = json.loads((DELIVERY/'final_image_evidence.json').read_text())
image_ids = {b['role']: b['image_id'] for b in image['builds']}
check('Root image build identities and content assertions', image['passed'] and image_ids == {'agent':'sha256:3f593199ab6a9df0be0f83d84677d2a44ed14c87d2a2513c0753767af5512ad4','verifier':'sha256:d6915a19e869c06e53cec589471172b2231df9a4481da6a0fa72101616fc3c4a'}, image_ids)
check('Root image source snapshot matches candidate manifest', all(manifest['source_sha256'][n] == h for n,h in image['source_before_build'].items()))
check('All 15 root verifier image content hashes match ZIP', len(image['verifier_source_hashes']) == 15 and all(sha(entries['tests/'+n]) == h for n,h in image['verifier_source_hashes'].items()))
semantic_review = [
    'Context, prompt and criteria all allow a pending candidate to remain hidden; no visible provisional DOM is a prerequisite.',
    'Further preview input while pending may be accepted, ignored or blocked; no forced hidden/disabled action is demanded and the original deadline remains authoritative.',
    'The pending-interaction probe first commits an independent successful change, then requires rollback to that latest committed state; static restored handlers are allowed.',
    'Actual stale-save conflict UI remains required; proactive prevention is accepted only with clear conflict feedback and exact dirty-draft retention, plus separate observed-format stale server refusal when needed.',
    'Initial examples may be any supported source language; language-appropriate comments create a separate saved user copy while the original built-in remains unchanged.',
    'Completed-preview Stop is an independent observable with recovery; optional removal/disablement of old controls is accepted.',
    'Product failures remain local and judging continues; evaluator failures use the incomplete marker, including global prerequisites and the single-use restart tool.',
    'Distinct saved records, unchanged gate record, restart at position 22, network-control setup/cleanup and public app resources agree across the three files.'
]
result = {'passed':all(c['passed'] for c in checks), 'archive_sha256':EXPECTED, 'shell_sha256':shell_hash, 'scope':'Read-only exact release/manifest/source/evidence rebinding and full semantic reread; unchanged execution was not repeated.', 'checks':checks, 'semantic_review':semantic_review, 'concrete_blockers':[], 'hosted_success_claimed':False, 'paid_or_platform_runs_used':0, 'limitations':['Actual CLI evidence validates parser, serializer and guard behavior with a local transport fixture, not model judgement quality.', 'Image content execution is the root build evidence; this audit independently reconciles its hashes and does not relabel it as a fresh image run.', 'No paid/hosted judge completion or full-suite latency result is available.']}
(HERE/'final_archive_review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'checks':len(checks),'concrete_blockers':result['concrete_blockers'],'archive_sha256':EXPECTED}))
assert result['passed']

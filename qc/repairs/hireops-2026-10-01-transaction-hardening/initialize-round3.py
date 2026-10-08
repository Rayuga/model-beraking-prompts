"""Set up evidence runners after the real pipeline freeze; never invent reviews."""
from pathlib import Path
import hashlib, json, shutil
ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
OLD = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r2'
HERE = Path(__file__).resolve().parent
M = json.loads((RUN / 'manifest.json').read_text())
assert not (RUN / 'review-contexts.json').exists(), 'Round already initialized; preserve actual reviewer dispatch records.'
L = RUN / 'local'
L.mkdir(exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for name in ['round-status.py', 'verify-local.py', 'verify-extra.py', 'bind-artifacts.py']:
    s = (OLD / name).read_text()
    s = s.replace('hardening-r2', 'hardening-r3').replace('hard-r2', 'hard-r3').replace('hard_r2_', 'hard_r3_')
    if name == 'verify-extra.py':
        s = s.replace("for n in ['batch-witnesses','batch-boundaries']:", "jobs.append(('install-isolation',base+['--entrypoint','python3',image,'/evidence/install-isolation.py']))\nfor n in ['batch-witnesses','batch-boundaries','targeted-golden','partial-budget-recovery']:")
    (RUN / name).write_bytes(s.encode('utf-8'))
for name in ['install-isolation.py', 'targeted-golden.cjs', 'partial-budget-recovery.cjs']:
    shutil.copyfile(HERE / 'post-r2-local' / name, L / name)

contexts = {'input_sha256': M['input_sha256'], 'quality_contexts': [],
            'scope': 'Record only actual fresh reviewer dispatches. No reused context may review another quality row.'}
(RUN / 'review-contexts.json').write_text(json.dumps(contexts, indent=2) + '\n')
index = {'input_sha256': M['input_sha256'],
         'scope': 'Raw observations only, excluding reviewer verdicts. Shared fixtures retain their original provenance and exact matching canonical-byte bindings. Full configured grading/workload, app reward discrimination/ranking and target/Oracle scores are absent.', 'entries': []}
old_index = json.loads((OLD / 'raw-evidence-index.json').read_text())
shared = ['tests/test.sh', 'tests/Dockerfile', 'tests/tools/score.py', 'tests/tools/restart_mcp.py', 'tests/scoring.toml']
old_m = json.loads((OLD / 'manifest.json').read_text())
binding = {p: M['inputs']['task'][p] for p in shared}
assert all(old_m['inputs']['task'][p] == h for p,h in binding.items())
for e in old_index['entries']:
    if 'hardening-r2/per-row-review/evidence/21/' in e['path'] or 'hardening-r1/per-row-review/evidence/46/' in e['path']:
        assert sha(ROOT / e['path']) == e['sha256']
        index['entries'].append({'path': e['path'], 'sha256': e['sha256'],
            'scope': 'Historical raw synthetic shared-harness fixture on byte-identical canonical files; no historical review verdict, hosted transfer result or app grade.', 'matching_source_files': binding})
(RUN / 'raw-evidence-index.json').write_text(json.dumps(index, indent=2) + '\n')
d = json.loads((OLD / 'difficulty-accounting.json').read_text())
d['input_sha256'] = M['input_sha256']
d['round2_repair_note'] = 'Functional remains 145 with unchanged 45 points. Preparation recovery split transfers 0.5 from commit recovery, giving 5 Polish criteria with unchanged 9 points and coordinated mass 6. No model score inferred.'
(RUN / 'difficulty-accounting.json').write_text(json.dumps(d, indent=2) + '\n')
print(json.dumps({'input_sha256': M['input_sha256'], 'initial_raw_artifacts': len(index['entries']), 'quality_contexts_dispatched': 0}))

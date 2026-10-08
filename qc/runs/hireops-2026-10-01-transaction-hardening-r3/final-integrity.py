"""Bind the finished local review, committed source, tested snapshot and ZIP.

Read-only with respect to task, archive, frozen inputs and review reports.
No model calls, implied grading result, or report verdict changes.
"""
from pathlib import Path
from collections import Counter
from decimal import Decimal
import hashlib
import json
import subprocess
import tomllib
import zipfile

RUN = Path(__file__).resolve().parent
ROOT = RUN.parents[2]
manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))
package = ROOT / 'deliverables/hireops-recruiting-operations/2026-10-01-hardening-r3'
candidate = json.loads((package / 'candidate_manifest.json').read_text(encoding='utf-8'))
commit = '4ec94aecf74dbbc8a6328ebab44ced846b5f8b96'
sha = lambda data: hashlib.sha256(data).hexdigest()
tree = lambda base: {p.relative_to(base).as_posix(): sha(p.read_bytes())
                     for p in base.rglob('*') if p.is_file()}
expected = manifest['inputs']['task']
checks = {}
checks['live_source'] = tree(ROOT / manifest['task']) == expected
checks['frozen_source'] = tree(ROOT / manifest['cache'] / 'task') == expected
checks['frozen_rules'] = tree(ROOT / manifest['cache'] / 'rules') == manifest['inputs']['rules']
checks['current_rules'] = all(sha((ROOT / p).read_bytes()) == h
                            for p, h in manifest['inputs']['rules'].items())
checks['engine_inputs'] = all(sha((ROOT / p).read_bytes()) == h
                              for p, h in manifest['engine_inputs'].items())
checks['manifest_source'] = candidate['source_sha256'] == expected
git_hashes = {}
for path in expected:
    data = subprocess.check_output(['git', 'show', f'{commit}:{manifest["task"]}/{path}'], cwd=ROOT)
    git_hashes[path] = sha(data)
checks['committed_source'] = git_hashes == expected
archive = package / candidate['archive']
archive_sha = sha(archive.read_bytes())
checks['archive_manifest_hash'] = archive_sha == candidate['sha256']
checks['archive_size'] = archive.stat().st_size == candidate['bytes']
with zipfile.ZipFile(archive) as z:
    infos = [i for i in z.infolist() if not i.is_dir()]
    prefix = candidate['single_root'] + '/'
    checks['archive_crc'] = z.testzip() is None
    checks['archive_roots'] = all(i.filename.startswith(prefix) for i in infos)
    archived = {i.filename[len(prefix):]: sha(z.read(i)) for i in infos}
    checks['archive_duplicates_absent'] = len(archived) == len(infos)
    checks['archive_source'] = archived == expected
    checks['archive_file_count'] = len(infos) == candidate['files'] == len(expected)
    checks['shell_line_endings'] = all(b'\r' not in z.read(i) for i in infos if i.filename.endswith('.sh'))
    checks['shell_modes'] = all((i.external_attr >> 16) & 0o111 for i in infos if i.filename.endswith('.sh'))
dimensions = {}
task = ROOT / manifest['task']
for folder in ['gates/constraints', 'gates/render', 'scored/functional', 'scored/polish', 'scored/visual']:
    data = tomllib.loads((task / 'tests' / folder / 'judge.toml').read_text(encoding='utf-8'), parse_float=Decimal)
    criteria = data['criterion']
    dimensions[folder.split('/')[-1]] = {'criteria': len(criteria), 'weight': float(sum(Decimal(c['weight']) for c in criteria))}
checks['dimensions_match_manifest'] = dimensions == candidate['dimensions']
index = json.loads((RUN / 'raw-evidence-index.json').read_text(encoding='utf-8'))
bad_evidence = [e['path'] for e in index['entries']
                if not (ROOT / e['path']).is_file() or sha((ROOT / e['path']).read_bytes()) != e['sha256']]
checks['raw_evidence_hashes'] = not bad_evidence
rows = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((RUN / 'per-row-review/rows').glob('[0-9][0-9].json'))]
checks['all_53_quality_rows'] = len(rows) == 53 and {r['number'] for r in rows} == set(range(1, 54))
checks['quality_input_bindings'] = all(r['input_sha256'] == manifest['input_sha256'] for r in rows)
contexts = json.loads((RUN / 'review-contexts.json').read_text(encoding='utf-8'))['quality_contexts']
checks['53_unique_fresh_contexts'] = (len(contexts) == 53 and len({c['agent'] for c in contexts}) == 53
    and {c['row'] for c in contexts} == set(range(1, 54)) and all(c['fork_turns'] == 'none' for c in contexts))
det = json.loads((RUN / 'per-row-review/deterministic.json').read_text(encoding='utf-8'))
checks['separate_all48_deterministic'] = len(det['deterministic']) == 48 and det['input_sha256'] == manifest['input_sha256']
out = {'input_sha256': manifest['input_sha256'], 'commit': commit,
       'archive': archive.relative_to(ROOT).as_posix(), 'archive_sha256': archive_sha,
       'archive_bytes': archive.stat().st_size, 'task_files': len(expected),
       'dimensions': dimensions, 'checks': checks, 'passed': all(checks.values()),
       'quality_verdict_counts': dict(Counter(r['verdict'] for r in rows)),
       'quality_risk_rows': [r['number'] for r in rows if r['risk']],
       'raw_evidence_entries': len(index['entries']), 'bad_evidence': bad_evidence,
       'scope': 'Integrity and local evidence binding only; no configured app grade, Oracle, Luna score or portal pass.'}
(RUN / 'final-integrity.json').write_text(json.dumps(out, indent=2) + '\n', encoding='utf-8')
print(json.dumps(out, indent=2))
raise SystemExit(0 if out['passed'] else 1)

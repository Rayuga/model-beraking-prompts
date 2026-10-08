from pathlib import Path
import hashlib, json
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
T = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {p.relative_to(T).as_posix(): sha(p) for p in T.rglob('*') if p.is_file()}
assert before == json.loads((HERE / 'round2-repairs.json').read_text())['task_sha256']

p = T / 'tests/scored/polish/judge.toml'
s = p.read_text(encoding='utf-8')
s = s.replace('Establish a valid ordinary UI coordinated preview/commit control. On dedicated current members,',
    'Establish a valid ordinary UI preparation control with a saved, readable preview. On dedicated current members,')
s = s.replace('then obtain a saved preview and successful commit without re-entering unchanged values. Owns preparation-stage',
    'then obtain a saved, readable corrected preview without re-entering unchanged values. Commit success is not required for this preparation-only observation. Owns preparation-stage')
p.write_bytes(s.encode('utf-8'))
p = T / 'tests/scored/polish/prompt.md'
s = p.read_text(encoding='utf-8')
s = s.replace('For coordinated preparation recovery, first establish a valid UI preview/commit control.',
    'For coordinated preparation recovery, first establish a valid UI preparation control with a saved, readable preview.')
s = s.replace('Correct only the offending input, use a new key if needed, then preview and commit successfully.',
    'Correct only the offending input, use a new key if needed, then save and read the corrected preview. This preparation-only observation does not require commit success.')
p.write_bytes(s.encode('utf-8'))
after = {p.relative_to(T).as_posix(): sha(p) for p in T.rglob('*') if p.is_file()}
assert [p for p,h in after.items() if before[p] != h] == ['tests/scored/polish/judge.toml','tests/scored/polish/prompt.md']
(HERE / 'round2-focused-repairs.json').write_text(json.dumps({'reason': 'Independent focused reviewers 26 and 28 confirmed preparation-only recovery must not depend on commit success.', 'before_sha256': before, 'task_sha256': after}, indent=2) + '\n')
print('Removed commit dependency from preparation-only recovery; no weight or product changes.')

"""One-time migration from the saved 2.0.16 source to the supplied standard."""
from pathlib import Path
import json, re, zipfile, tomllib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
REF = ROOT / 'projects/bazaarbridge-marketplace-commerce'

def read(p):
    return p.read_text(encoding='utf-8')

def write(p, s):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding='utf-8', newline='\n')

baseline = OUT / 'before-migration.zip'
assert not baseline.exists(), 'Migration already started; do not overwrite baseline'
with zipfile.ZipFile(baseline, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(TASK.rglob('*')):
        if p.is_file():
            z.write(p, p.relative_to(TASK).as_posix())

# Use precisely the reference key set; only descriptive task metadata differs.
source = read(REF / 'task.toml')
replacements = {
    'task': {
        'name': 'turing/patchpad-editor-v2',
        'description': 'Full-stack custom incident-report editor with Unicode-aware editing, real mouse selection, clipboard and multi-caret operations, SQLite revision history, restart durability, and conflict-safe saves. Five browser verifier dimensions assess rendering, constraints, functional correctness, usability, and rendered presentation.',
        'keywords': ['webdev', 'turing', 'full-stack', 'nodejs', 'express', 'sqlite', 'custom-editor', 'revision-history', 'browser-judge', 'rewardkit'],
    },
    'metadata': {
        'difficulty_explanation': 'The editor must preserve exact long-document content across Unicode navigation, mouse and keyboard selection, atomic clipboard and multi-caret edits, Undo/Redo, Find/Replace, saved history and server restarts. Concurrent and malformed saves must preserve authoritative content and revisions. Presentation is assessed separately from behavior.',
        'provenance': 'PatchPad migrated from the locally preserved 2.0.16 source to the Bazaarbridge marketplace commerce configuration standard supplied on 2026-09-11. Existing functional criteria and seed are preserved; judge procedure is clarified and a separate visual dimension is added.',
        'arena_slice': 'full-stack-node-express-sqlite-custom-editor',
    },
}
for section, values in replacements.items():
    start = source.index(f'[{section}]')
    end = source.find('\n[', start + 1)
    if end < 0: end = len(source)
    block = source[start:end]
    for key, value in values.items():
        pattern = rf'(?ms)^{re.escape(key)} = (?:""".*?"""|[^\n]*)'
        block, count = re.subn(pattern, lambda m: key + ' = ' + json.dumps(value), block)
        assert count == 1, key
    source = source[:start] + block + source[end:]
write(TASK / 'task.toml', source)

# Same images, tools, versions, configuration and command layout as reference.
# Seed and instruction COPY paths are task-specific.
write(TASK / 'environment/Dockerfile', read(REF / 'environment/Dockerfile').replace('COPY instructions/', 'COPY assets/instructions/'))
docker = read(REF / 'tests/Dockerfile').replace('bazaarbridge-marketplace-commerce', 'patchpad-editor-v2')
docker = docker.replace('COPY . /tests', 'COPY incident_seed.json /assets/incident_seed.json\nRUN chmod -R a+rX /assets\nCOPY . /tests')
write(TASK / 'tests/Dockerfile', docker)

# Retain the task-specific seed reset, manifest, npm start and restart helper.
# All grading/post-processing follows the reference, including CTRF output.
runner = read(TASK / 'tests/test.sh')
ref_runner = read(REF / 'tests/test.sh')
runner = runner[:runner.index('if ! timeout ')] + ref_runner[ref_runner.index('if ! timeout 12600'):]
runner = runner.replace('"polish":0.0,"graded"', '"polish":0.0,"visual":0.0,"graded"')
ctrf_line = next(l for l in ref_runner.splitlines() if "printf" in l and 'ctrf.json' in l)
runner = runner.replace('\n}\n\nensure_reward()', '\n' + ctrf_line + '\n}\n\nensure_reward()', 1)
runner = runner.replace(', Path("/opt/patchpad-deps")', '')
write(TASK / 'tests/test.sh', runner)
write(TASK / 'tests/reward.toml', read(REF / 'tests/reward.toml'))

# Standard judge configuration header, existing criterion IDs and assertions.
for dim in ['render', 'constraints', 'functional', 'polish']:
    p = TASK / f'tests/{dim}/judge.toml'
    old = read(p)
    ref = read(REF / f'tests/{dim}/judge.toml')
    header = ref[:ref.index('[[criterion]]')].replace('bazaarbridge-', 'patchpad-editor-v2-')
    # Preserve all_pass gates: custom-surface refusal must still give Constraints 0.
    aggregation = tomllib.loads(old)['scoring']['aggregation']
    header = header.replace('aggregation = "weighted_mean"', f'aggregation = "{aggregation}"')
    body = old[old.index('[[criterion]]'):]
    body = re.sub(r'\n\[scoring\]\naggregation = "[^"]+"\s*', '\n', body)
    if dim == 'polish':
        body = re.sub(r'\[\[criterion\]\]\nid = "editor_visual_hierarchy".*?(?=\[\[criterion\]\]|\Z)', '', body, flags=re.S)
    write(p, header + body)
    prompt = TASK / f'tests/{dim}/prompt.md'
    write(prompt, read(prompt).replace('v2.0.16', 'v1.0.0'))

# Use the reference's preinstalled Express; keep all editor/server logic intact.
overview = TASK / 'environment/assets/instructions/overview.md'
write(overview, read(overview).replace('Express 5.2.1 is already available under `/opt/patchpad-deps`.', 'Express 5.1.0 is already available under `/usr/local/lib/node_modules`.'))
solve = read(TASK / 'solution/solve.sh')
solve = solve.replace('test -d /opt/patchpad-deps/node_modules', 'test -d /usr/local/lib/node_modules/express')
solve = solve.replace('cp -R /opt/patchpad-deps/node_modules ./node_modules', 'mkdir -p node_modules\ncp -R /usr/local/lib/node_modules/express node_modules/express')
write(TASK / 'solution/solve.sh', solve)
pkg = TASK / 'solution/app/package.json'
data = json.loads(read(pkg)); data['version'] = '1.0.0'; data['dependencies']['express'] = '5.1.0'
write(pkg, json.dumps(data, indent=2) + '\n')
print('Migrated standard configuration; baseline preserved at', baseline)

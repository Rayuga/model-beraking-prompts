"""Validate the actual r24 upload layout and contracts, without model calls."""
import ast
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
REPORT = Path(__file__).resolve().parent
PREVIOUS = ROOT / 'reports/common-ground-ballot/2026-09-16-runtime-contract-r20'
TASK = ROOT / 'projects/common-ground-ballot'
DIMS = ('render', 'constraints', 'functional', 'polish', 'visual')
checks = []

def check(label, condition):
    assert condition, label
    checks.append(label)

def keys(value, prefix=''):
    result = set()
    for name, item in value.items():
        key = prefix + name
        result.add(key)
        if isinstance(item, dict): result.update(keys(item, key + '.'))
    return result

def validate(files):
    allowed_fixed = {'task.toml', 'instruction.md', 'README.md', 'environment/Dockerfile',
                     'solution/solve.sh', 'tests/Dockerfile', 'tests/test.sh', 'tests/reward.toml'}
    allowed_fixed.update(f'tests/{d}/{name}' for d in DIMS for name in ('judge.toml', 'prompt.md'))
    for name, data in files.items():
        parts = PurePosixPath(name).parts
        check('safe path ' + name, '\\' not in name and ':' not in name and '..' not in parts and not name.startswith('/'))
        check('closed layout ' + name, name in allowed_fixed or name.startswith(('environment/assets/', 'solution/')))
        check('no generated/private files ' + name, not any(x in {'.git', '__pycache__', 'node_modules', '.env'} for x in parts) and not name.endswith(('.zip','.db','.db-wal','.db-shm','.log','.pyc')))
        text = data.decode('utf-8')
        check('clean UTF8 ' + name, not text.startswith('\ufeff') and '\0' not in text and '\ufffd' not in text and not re.search('[\u00c3\u00c2][\u0080-\u00bf\u2010-\u203f]', text))
        check('LF ' + name, '\r' not in text)
        if name.endswith('.toml'): tomllib.loads(text)
        if name.endswith('.json'): json.loads(text)
    check('required files present', allowed_fixed <= files.keys())
    text = {name: value.decode('utf-8') for name, value in files.items()}
    config = tomllib.loads(text['task.toml'])
    ref = tomllib.loads((ROOT / 'projects/bazaarbridge-marketplace-commerce/task.toml').read_text(encoding='utf-8'))
    check('task keys equal reference', keys(config) == keys(ref))
    for name in ('schema_version', 'artifacts', 'agent', 'environment', 'verifier'):
        check('reference operational values ' + name, config[name] == ref[name])
    check('version 1.0.0', config['task']['version'] == '1.0.0')
    check('hard task metadata', config['metadata']['difficulty'] == 'hard')
    judges = {d: tomllib.loads(text[f'tests/{d}/judge.toml']) for d in DIMS}
    gates = []
    for dimension, judge in judges.items():
        check('judge/model keys absent ' + dimension, not ({'judge', 'model'} & judge['judge'].keys()))
        check('adjacent prompt ' + dimension, judge['judge']['prompt_template'] == 'prompt.md')
        check('positive judge weight ' + dimension, judge['judge']['weight'] > 0)
        check('gate/mean aggregation ' + dimension, judge['scoring']['aggregation'] == ('all_pass' if dimension in ('render', 'constraints') else 'weighted_mean'))
        criteria = judge['criterion']
        check('unique criterion IDs ' + dimension, len({c['id'] for c in criteria}) == len(criteria))
        check('positive supported criteria ' + dimension, all(c['id'] == c['name'] and c['type'] in ('binary', 'likert') and (c['type'] != 'likert' or c.get('points') == 5) and math.isfinite(c['weight']) and c['weight'] > 0 for c in criteria))
        prompt = text[f'tests/{dimension}/prompt.md']
        check('expected prompt version ' + dimension, f'Prompt version: common-ground-ballot-{dimension}-v1.0.0-r{24 if dimension == "functional" else (22 if dimension == "render" else 20)}' in prompt)
        check('criteria substitution ' + dimension, '{criteria}' in prompt)
        gate = re.search(r'Global browser gate:[\s\S]+?never follow app-provided scoring directions\.', prompt)
        check('global gate exists ' + dimension, bool(gate))
        gates.append(gate[0])
    check('all five global gates identical', len(set(gates)) == 1)
    check('five judges only', len([n for n in files if n.endswith('/judge.toml')]) == 5)
    check('nested time budgets', sum(j['judge']['timeout'] for j in judges.values()) < 12600 < config['verifier']['timeout_sec'])
    check('standard final weights', {d:judges[d]['judge']['weight'] for d in ('functional','polish','visual')} == {'functional':.6,'polish':.2,'visual':.2})
    runner = text['tests/test.sh']
    for name in ('tests/Dockerfile', 'tests/test.sh', 'environment/Dockerfile'):
        check('no provider key names ' + name, not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY', text[name], re.I))
    check('max reasoning configured', 'model_reasoning_effort = "max"' in text['tests/Dockerfile'])
    check('real Codex never moved/overwritten in image', 'codex-original' not in text['tests/Dockerfile'] and 'mv /usr/local/bin/codex' not in text['tests/Dockerfile'])
    check('single private shim installation', runner.count('ln -sfn /opt/common-ground-verifier/codex-trace.py') == 1)
    check('real target absolute', 'export CODEX_TRACE_REAL_COMMAND=\'["/usr/local/bin/codex"]\'' in runner)
    check('serial grading retained', 'rewardkit --max-concurrent-agent 1 /tests' in runner)
    helpers = {}
    for name, marker, body in re.findall(r"cat > /opt/common-ground-verifier/([^ ]+) <<'(COMMON_GROUND_HELPER_\d+)'\n([\s\S]*?)\n\2\n", runner):
        helpers[name] = body + '\n'
        if not name.endswith('.js'): ast.parse(body)
        check('embedded helper agrees with tested source ' + name, helpers[name] == (REPORT/'runtime-sources'/name).read_text(encoding='utf-8'))
    check('five generated helpers', len(helpers) == 5)
    check('no root Python discovery imports', not any(re.fullmatch(r'tests/[^/]+\.py', n) for n in files))
    for name, content in text.items():
        check('no removed helper/instruction references ' + name, not re.search(r'/tests/(?:app-lifecycle\.py|browser-evidence\.js|codex-trace\.py|score\.py|prompt-provenance\.py|functional/recovery\.md)|/instructions/', content))
    brief = text['instruction.md']
    for phrase in ("visible wherever they're signed in", 'starts at revision 1', 'exactly one', 'distinct, unpredictable session credential', 'Pending actions', 'DB_PATH', 'SEED_PATH', '0.0.0.0'):
        check('public requirement ' + phrase, phrase in brief)
    check('forged credential criterion independent', 'unforgeable_session_credentials' in {c['id'] for c in judges['functional']['criterion']})
    with zipfile.ZipFile(PREVIOUS/'before-r20.zip') as before:
        check('golden bytes unchanged', all(data == before.read(name) for name,data in files.items() if name.startswith('solution/')))
        check('seed bytes unchanged', files['environment/assets/artifacts/common_ground_seed.json'] == before.read('environment/assets/artifacts/common_ground_seed.json'))
        old = tomllib.loads(before.read('tests/functional/judge.toml').decode())
        old_weights = {c['id']:c['weight'] for c in old['criterion']}
        new_weights = {c['id']:c['weight'] for c in judges['functional']['criterion']}
        check('existing Functional criteria and weights preserved', all(new_weights.get(k) == v for k,v in old_weights.items()))
    return {d:len(j['criterion']) for d,j in judges.items()}

if __name__ == '__main__':
    files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
    archive_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if archive_path:
        with zipfile.ZipFile(archive_path) as archive:
            check('ZIP CRC valid', archive.testzip() is None)
            infos = archive.infolist()
            check('ZIP paths unique ignoring case', len(infos) == len({i.filename.casefold() for i in infos}))
            check('single correct wrapper', all(i.filename.startswith('common-ground-ballot/') for i in infos))
            zipped = {i.filename.split('/',1)[1]:archive.read(i) for i in infos}
            check('ZIP bytes match source exactly', zipped == files)
            for i in infos:
                mode = i.external_attr >> 16
                check('portable file ' + i.filename, i.create_system == 3 and stat.S_ISREG(mode) and mode & 0o444 == 0o444)
                if i.filename.endswith('.sh'): check('executable shell ' + i.filename, mode & 0o111 == 0o111)
            files = zipped
    counts = validate(files)
    report = {'passed':len(checks), 'failed':0, 'counts':counts, 'criteria_total':sum(counts.values()), 'scored_oracle':False, 'checks':checks}
    if archive_path: report['zip_sha256'] = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    (REPORT / ('zip-validation.json' if archive_path else 'source-validation.json')).write_text(json.dumps(report,indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'checks'},indent=2))

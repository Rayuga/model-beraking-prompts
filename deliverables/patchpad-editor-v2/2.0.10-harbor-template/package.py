"""Release audit and clean ZIP. Never invokes a provider or edits task sources."""
import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
REPO = OUT.parents[2]
SLUG = OUT.parent.name
PREVIOUS = {
    'patchpad-editor-v2': ('2.0.9-oracle-repair', '2.0.10', 35),
    'brickfall-breaker-arcade': ('2.0.1-browser-gate', '2.0.2', 27),
}[SLUG]
TASK = REPO / 'projects' / SLUG
checks = []
def check(name, condition):
    assert condition, name
    checks.append(name)
def text(data):
    return data.decode('utf-8').replace('\r\n', '\n')
def digest(data):
    return hashlib.sha256(data).hexdigest()

oldzip = OUT.parent / PREVIOUS[0] / (SLUG + '.zip')
with zipfile.ZipFile(oldzip) as archive:
    old = {n[len(SLUG)+1:]: archive.read(n) for n in archive.namelist() if not n.endswith('/')}
current = {str(p.relative_to(TASK)).replace('\\','/'): p.read_bytes()
           for p in TASK.rglob('*') if p.is_file()}
check('Same complete task file inventory as historical release; no extra upload files', set(current) == set(old))
for name in current:
    check('Safe path: ' + name, not any(p in name.split('/') for p in ('..','node_modules','__pycache__','.git')))
    check('No secret literal: ' + name, not re.search(rb'sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}', current[name]))
    check('No database/cache/report: ' + name, Path(name).suffix.lower() not in ('.db','.sqlite','.sqlite3','.pyc','.log','.zip'))
    if Path(name).suffix in ('.sh','.md','.toml','.json','.js','.css','.html') or name.endswith('Dockerfile'):
        check('LF and UTF-8 without BOM: ' + name, b'\r' not in current[name] and not current[name].startswith(b'\xef\xbb\xbf'))
        text(current[name])
    if name.endswith('.toml'):
        tomllib.loads(text(current[name]))

config = tomllib.loads(text(current['task.toml']))
oldconfig = tomllib.loads(text(old['task.toml']))
check('Exact task name and release version', config['task']['name'] == 'turing/' + SLUG and config['task']['version'] == PREVIOUS[1])
check('Both networks public; separate verifier', config['environment']['network_mode'] == 'public' and config['verifier']['environment']['network_mode'] == 'public' and config['verifier']['environment_mode'] == 'separate')
check('Only platform OpenRouter key placeholder', config['verifier']['env'] == {
    'OPENROUTER_API_KEY': '${OPENROUTER_API_KEY}',
    'REWARDKIT_JUDGE': 'codex', 'REWARDKIT_MODEL': 'openai/gpt-5.6-luna',
    'REWARDKIT_REASONING_EFFORT': 'high'})
oldconfig['task']['version'] = config['task']['version']
oldconfig['verifier']['env'].pop('OPENAI_API_KEY')
oldconfig['verifier']['env'].pop('OPENAI_BASE_URL')
check('No other task configuration changes', config == oldconfig)
check('No key/provider setup in runner', not re.search(r'OPENAI|OPENROUTER|API_KEY|model_provider', text(current['tests/test.sh'])))
check('Runner unchanged', text(current['tests/test.sh']) == text(old['tests/test.sh']))

dimensions = [n for n in current if n.endswith('/judge.toml')]
total, budgets = 0, []
for name in dimensions:
    dim = tomllib.loads(text(current[name]))
    check('All verifier semantics unchanged: ' + name, dim == tomllib.loads(text(old[name])))
    check('Codex Luna judge: ' + name, dim['judge']['judge'] == 'codex' and dim['judge']['model'] == 'openai/gpt-5.6-luna')
    total += len(dim['criterion'])
    budgets.append(dim['judge']['timeout'])
check('Criterion count preserved', total == PREVIOUS[2])
runner = text(current['tests/test.sh'])
match = re.search(r'timeout\s+(?:--\S+\s+)*(\d+)\s+(?:\\\n\s*)?rewardkit', runner)
check('Bounded RewardKit runner', bool(match))
wrapper = int(match.group(1))
check('Judge timeout sum below runner below verifier', sum(budgets) < wrapper < config['verifier']['timeout_sec'])
check('Total environment + agent + verifier budget within six hours', config['environment']['build_timeout_sec'] + config['agent']['timeout_sec'] + config['verifier']['timeout_sec'] <= 21600)

allowed = {'task.toml','environment/Dockerfile','tests/Dockerfile','solution/app/package.json','solution/app/package-lock.json'}
allowed.update(n for n in current if n.startswith('tests/') and n.endswith(('/judge.toml','/prompt.md')))
for name in current:
    if name not in allowed:
        check('Requirement/app/runner/seed unchanged: ' + name,
              current[name] == old[name] if Path(name).suffix == '.xlsx' else text(current[name]) == text(old[name]))
    elif name.endswith('/prompt.md'):
        check('Prompt body unchanged: ' + name, text(current[name]).split('\n',1)[1] == text(old[name]).split('\n',1)[1])
    elif name.endswith('package.json') or name.endswith('package-lock.json'):
        a,b = json.loads(current[name]),json.loads(old[name])
        check('Package version: ' + name, a['version'] == PREVIOUS[1])
        b['version'] = a['version']
        if 'packages' in a:
            check('Lock root version', a['packages']['']['version'] == PREVIOUS[1])
            b['packages']['']['version'] = a['packages']['']['version']
        check('No runtime dependency changes: ' + name, a == b)
docker = text(current['tests/Dockerfile'])
check('No task installation of judge/browser tools', not re.search(r'@openai/codex|@playwright/mcp|harbor-rewardkit|install --with-deps chromium', docker))
check('No hardcoded Harbor provider or MCP configuration', '/root/.codex' not in docker and '/usr/local/bin/chromium' not in docker)
check('Agent TLS/bootstrap prerequisites explicit', all(s in text(current['environment/Dockerfile']) for s in ('ca-certificates','curl','coreutils','update-ca-certificates','test -s /etc/ssl/certs/ca-certificates.crt')))

target = OUT / (SLUG + '.zip')
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(current.items()):
        item = zipfile.ZipInfo(SLUG + '/' + name, (2026,9,10,0,0,0))
        item.create_system = 3
        item.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        item.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(item, data)
with zipfile.ZipFile(target) as archive:
    check('ZIP CRC', archive.testzip() is None)
    check('Exactly one canonical wrapper', {n.split('/')[0] for n in archive.namelist()} == {SLUG})
    check('Archive exact inventory', set(archive.namelist()) == {SLUG + '/' + n for n in current})
    check('Every ZIP member hash equals current source', all(digest(archive.read(SLUG+'/'+n)) == digest(d) for n,d in current.items()))
report = {
    'task': SLUG, 'version': PREVIOUS[1], 'zip': target.name, 'sha256': digest(target.read_bytes()),
    'files': len(current), 'criteria': total, 'passed_checks': checks,
    'timeouts': {'judge_sum': sum(budgets), 'runner':wrapper,'verifier':config['verifier']['timeout_sec']},
    'source_hashes': {n:digest(d) for n,d in sorted(current.items())},
    'historical_zip_sha256':digest(oldzip.read_bytes()),
    'scope':'Structural/configuration and unchanged-behavior audit only. No paid run or platform QC.',
    'remaining_risks': [
        'Harbor injection of judge, RewardKit, browser/MCP, and OpenRouter provider setup is required per lead guidance but not verified locally.',
        'Fresh Docker builds blocked by local proxy DNS; exact new image execution not validated.',
        'Browser regressions use current mounted task code in a historical local tool image, not the new verifier image.'
    ]}
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(OUT/'SHA256SUMS.txt').write_text(report['sha256']+'  '+target.name+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ('task','version','files','criteria','sha256','timeouts')}))
print('PASS',len(checks),'structural assertions; NOT platform QC or Oracle')

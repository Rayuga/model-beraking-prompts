from pathlib import Path
import hashlib
import json
import re
import tomllib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = ROOT / 'projects/dropline-four-lite'
TASK = ROOT / 'projects/dropline-four-lite-v2'
REF = ROOT / 'projects/bazaarbridge-marketplace-commerce'
WEIGHTS = ROOT / 'projects/docketlight-claims-insurance'
BRICK = ROOT / 'projects/brickfall-breaker-arcade'

def hashes(directory):
    return {p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(directory.rglob('*')) if p.is_file()}

def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8', newline='\n')

assert TASK.exists() and not (HERE / 'baseline.json').exists()
baseline = hashes(OLD)
write(HERE / 'baseline.json', json.dumps({'original': str(OLD), 'hashes': baseline}, indent=2) + '\n')
old_cfg = tomllib.loads((OLD / 'task.toml').read_text())
reference = (REF / 'task.toml').read_text()
operational = reference[reference.index('[agent]'):]
cfg = 'schema_version = "1.4"\nartifacts = ["/app"]\n\n[task]\n'
for key in ['name', 'version', 'description', 'keywords']:
    value = {'name': 'turing/dropline-four-lite-v2', 'version': '1.0.0'}.get(key, old_cfg['task'][key])
    cfg += key + ' = ' + json.dumps(value) + '\n'
cfg += '\n[metadata]\n'
for key in ['difficulty', 'difficulty_explanation', 'category', 'tags', 'provenance', 'arena_slice']:
    cfg += key + ' = ' + json.dumps(old_cfg['metadata'][key]) + '\n'
write(TASK / 'task.toml', cfg + '\n' + operational)

agent_docker = (BRICK / 'environment/Dockerfile').read_text()
write(TASK / 'environment/Dockerfile', agent_docker)
verifier_docker = (BRICK / 'tests/Dockerfile').read_text().replace('brickfall-breaker-arcade', TASK.name)
verifier_docker = verifier_docker.replace('COPY brickfall_seed.xlsx /assets/artifacts/brickfall_seed.xlsx\nCOPY brickfall_scenarios.json /assets/artifacts/brickfall_scenarios.json', 'COPY assets /assets')
write(TASK / 'tests/Dockerfile', verifier_docker)
runner = (BRICK / 'tests/test.sh').read_text().replace('brickfall-breaker-arcade', TASK.name).replace('brickfall', 'dropline')
write(TASK / 'tests/test.sh', runner)
write(TASK / 'tests/reward.toml', (REF / 'tests/reward.toml').read_text())

for dim in ['render', 'constraints', 'functional', 'polish']:
    old = (OLD / f'tests/{dim}/judge.toml').read_text()
    config = (REF / f'tests/{dim}/judge.toml').read_text().split('[scoring]', 1)[0]
    config = '\n'.join(line for line in config.splitlines() if not line.lstrip().startswith('#'))
    weight = tomllib.loads((WEIGHTS / f'tests/{dim}/judge.toml').read_text())['judge']['weight']
    config = re.sub(r'^weight = .+$', 'weight = ' + str(weight), config, flags=re.M)
    scoring = old[old.index('[scoring]'):]
    write(TASK / f'tests/{dim}/judge.toml', config.strip() + '\n\n' + scoring)

package = json.loads((TASK / 'solution/app/package.json').read_text())
package.update(name=TASK.name, version='1.0.0')
write(TASK / 'solution/app/package.json', json.dumps(package, indent=2) + '\n')
solve = (TASK / 'solution/solve.sh').read_text().replace('dropline-four-lite', TASK.name)
write(TASK / 'solution/solve.sh', solve)
assert hashes(OLD) == baseline
print('Migrated configuration only; original v6.0.3 source unchanged.')

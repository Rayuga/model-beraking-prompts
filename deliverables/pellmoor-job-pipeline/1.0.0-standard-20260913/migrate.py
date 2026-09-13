from pathlib import Path
import json,re,tomllib,hashlib
root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
task=root/'projects/pellmoor-job-pipeline'
backup=out/'source-before-standard'
ref=root/'projects/bazaarbridge-marketplace-commerce'
runner_ref=root/'projects/dropline-four-connect'
assert not (out/'migration.json').exists()
read=lambda p:p.read_text(encoding='utf-8')
old=tomllib.loads(read(backup/'task.toml'))
standard=tomllib.loads(read(ref/'task.toml'))
for k in standard['metadata']:assert k in old['metadata'],k
header='schema_version = "1.4"\nartifacts = ["/app"]\n\n[task]\n'
for k in standard['task']:
    value='1.0.0' if k=='version' else old['task'][k]
    if k=='keywords':value=[x for x in value if x not in ('codearena','browser-judge','rewardkit')]
    header+=k+' = '+json.dumps(value)+'\n'
header+='\n[metadata]\n'
for k in standard['metadata']:header+=k+' = '+json.dumps(old['metadata'][k])+'\n'
header+='\n[agent]'+read(ref/'task.toml').split('[agent]',1)[1]
(task/'task.toml').write_text(header,encoding='utf-8')
extra='      typescript@5.7.2 \\\n      esbuild@0.24.2 \\\n      d3@7.9.0 \\\n'
env=read(runner_ref/'environment/Dockerfile').replace('      xlsx@0.18.5 \\\n',extra)
env=env.replace('COPY assets/ /assets/','COPY assets/recruitment/ /recruitment/').replace('/instructions /assets','/instructions /recruitment')
(task/'environment/Dockerfile').write_text(env,encoding='utf-8')
docker=read(runner_ref/'tests/Dockerfile').replace('dropline-four-connect','pellmoor-job-pipeline').replace('      xlsx@0.18.5 \\\n',extra)
docker=docker.replace('COPY assets /assets\nRUN chmod -R a+rX /assets','COPY pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json\nRUN chmod -R a+rX /recruitment')
(task/'tests/Dockerfile').write_text(docker,encoding='utf-8')
for name in ('test.sh','app-lifecycle.sh'):
    text=read(runner_ref/'tests'/name).replace('dropline-four-connect','pellmoor-job-pipeline').replace('dropline','pellmoor')
    text=text.replace('/app/server.js','/app/backend/server.js').replace('$APP_COPY/server.js','$APP_COPY/backend/server.js').replace('/tmp/pellmoor-submission/server.js','/tmp/pellmoor-submission/backend/server.js')
    (task/'tests'/name).write_text(text,encoding='utf-8')
(task/'tests/reward.toml').write_text(read(ref/'tests/reward.toml'),encoding='utf-8')
package=json.loads(read(task/'solution/package.json'));package['version']='1.0.0'
(task/'solution/package.json').write_text(json.dumps(package,indent=2)+'\n',encoding='utf-8')
solve=read(task/'solution/solve.sh')
solve='\n'.join(line for line in solve.splitlines() if not line.startswith('#') or line.startswith('#!'))+'\n'
solve=solve.replace('cp "$SRC/tsconfig.json"', 'cp "$SRC/APP_MANIFEST.md" "$ROOT/APP_MANIFEST.md"\ncp "$SRC/tsconfig.json"')
(task/'solution/solve.sh').write_text(solve,encoding='utf-8')
criteria={}
for dim in ('render','constraints','functional','polish'):
    text=read(backup/f'tests/{dim}/judge.toml')
    criteria[dim]=['[[criterion]]'+s for s in text.split('[[criterion]]')[1:]]
moved=[]
for id in ('worded_action_and_error_feedback','pending_state_and_duplicate_prevention'):
    block=next(x for x in criteria['polish'] if f'id = "{id}"' in x)
    criteria['polish'].remove(block);moved.append(block)
criteria['functional'][-1:-1]=moved
for dim,blocks in criteria.items():
    prefix=read(runner_ref/f'tests/{dim}/judge.toml').split('[[criterion]]')[0]
    (task/f'tests/{dim}/judge.toml').write_text(prefix+''.join(blocks),encoding='utf-8')
report=dict(old_version=old['task']['version'],new_version='1.0.0',moved_to_functional=['worded_action_and_error_feedback','pending_state_and_duplicate_prevention'],source_hashes={p.relative_to(backup).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in backup.rglob('*') if p.is_file()})
(out/'migration.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Migrated configuration and preserved original criterion weights')

import hashlib,json,subprocess,zipfile,tomllib
from pathlib import Path
root=Path(__file__).resolve().parents[4];out=Path(__file__).resolve().parent
task=root/'projects/hireops-recruiting-operations/hireops-recruiting-operations'
delivery=root/'deliverables/hireops-recruiting-operations/2026-10-01-current'
m=json.loads((delivery/'candidate_manifest.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
live={p.relative_to(task).as_posix():sha(p.read_bytes()) for p in task.rglob('*') if p.is_file()}
z=delivery/m['archive']
with zipfile.ZipFile(z) as a:
 members={n.split('/',1)[1]:sha(a.read(n)) for n in a.namelist() if not n.endswith('/')}
 archive={'path':z.relative_to(root).as_posix(),'sha256':sha(z.read_bytes()),'bytes':z.stat().st_size,'files':len(members),'crc':a.testzip(),'single_root':sorted({n.split('/')[0] for n in a.namelist()}),'shell_modes':{x.filename:oct((x.external_attr>>16)&0o777) for x in a.infolist() if x.filename.endswith('.sh')},'matches_live':members==live,'matches_manifest':members==m['source_sha256']}
images={}
for kind in ['agent','verifier']:
 tag='hireops-'+kind+':20261001-handoff'
 images[kind]={'tag':tag,'id':json.loads(subprocess.check_output(['docker','image','inspect',tag],text=True))[0]['Id']}
 prefix='environment' if kind=='agent' else 'tests'
 code="import pathlib,hashlib,json; print(json.dumps({p.as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for base in ['/tests'] for p in pathlib.Path(base).rglob('*') if p.is_file()}))"
 if kind=='agent':
  code="const fs=require('fs'),c=require('crypto');let r={};for(const b of ['/instructions','/assets']){function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())w(p);else r[p]=c.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}}w(b)}console.log(JSON.stringify(r))"
  cmd=['docker','run','--rm','--network','none',tag,'node','-e',code]
 else:cmd=['docker','run','--rm','--network','none',tag,'python3','-c',code]
 values=json.loads(subprocess.check_output(cmd,text=True));images[kind]['file_hashes']=values
 expected={('/'+n if kind=='verifier' else n.removeprefix('environment')):h for n,h in live.items() if n.startswith('tests/') or (kind=='agent' and (n.startswith('environment/instructions/') or n.startswith('environment/assets/')))} if kind=='verifier' else {n.removeprefix('environment'):h for n,h in live.items() if n.startswith(('environment/instructions/','environment/assets/'))}
 images[kind]['build_only_exclusions']=['/tests/Dockerfile','/tests/.dockerignore'] if kind=='verifier' else []
 images[kind]['expected_bytes_match']=all(values.get(p)==h for p,h in expected.items() if p not in images[kind]['build_only_exclusions'])
shared={}
template=root/'projects/webdev-task-template'
for n in ['tests/test.sh','tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml','environment/Dockerfile','tests/Dockerfile','environment/instructions/integration.md']:
 shared[n]={'task_sha256':live[n],'template_sha256':sha((template/n).read_bytes()),'identical':(task/n).read_bytes()==(template/n).read_bytes()}
result={'archive':archive,'source_files':live,'shared_template':shared,'images':images,'dimensions':{p.parent.name:len(tomllib.loads(p.read_text())['criterion']) for p in task.glob('tests/*/*/judge.toml')},'provider_runs':False}
(out/'input-binding.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['source_files','images']},indent=2));print({k:v['expected_bytes_match'] for k,v in images.items()})
assert archive['matches_live'] and archive['matches_manifest'] and archive['crc'] is None
assert all(x['expected_bytes_match'] for x in images.values())

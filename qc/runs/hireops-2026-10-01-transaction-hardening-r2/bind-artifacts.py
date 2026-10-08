from pathlib import Path
import hashlib,json,subprocess,zipfile
R=Path(__file__).resolve().parents[3];RUN=Path(__file__).resolve().parent;M=json.loads((RUN/'manifest.json').read_text());T=R/M['cache']/'task';D=R/'deliverables/hireops-recruiting-operations/2026-10-01-hardening-r2';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
C=json.loads((D/'candidate_manifest.json').read_text());assert C['source_sha256']==M['inputs']['task'];assert sha(D/C['archive'])==C['sha256']
with zipfile.ZipFile(D/C['archive']) as z:
 assert z.testzip() is None
 contents={n.split('/',1)[1]:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()};assert contents==M['inputs']['task']
image_results={}
for image,folders in [('hireops-verifier:20261001-hard-r2',['/tests']),('hireops-agent:20261001-hard-r2',['/instructions','/assets'])]:
 # Node is available in both images; this only hashes shipped data, no provider call.
 code="const fs=require('fs'),path=require('path'),c=require('crypto'),o={};function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else o[p]=c.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}};"+''.join('w('+json.dumps(d)+');' for d in folders)+"console.log(JSON.stringify(o))"
 actual=json.loads(subprocess.check_output(['docker','run','--rm','--network','none','--entrypoint','node',image,'-e',code]))
 expected={}
 for p,h in M['inputs']['task'].items():
  if image.startswith('hireops-verifier') and p.startswith('tests/') and p not in ['tests/Dockerfile','tests/.dockerignore']:expected['/'+p]=h
  elif image.startswith('hireops-agent') and p.startswith(('environment/instructions/','environment/assets/')):expected['/'+p.removeprefix('environment/')]=h
 assert all(actual.get(p)==h for p,h in expected.items()),(image,expected,actual)
 image_results[image]={'id':json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]['Id'],'source_files_matched':len(expected),'expected_source_sha256':expected,'actual_file_sha256':actual}
record={'input_sha256':M['input_sha256'],'archive_sha256':C['sha256'],'archive_matches_frozen_tested_source':True,'archive_file_count':len(contents),'images':image_results,'scope':'Exact byte identity, CRC and container contents only; no grade claim.'}
(RUN/'artifact-binding.json').write_text(json.dumps(record,indent=2)+'\n')
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={e['path']:e for e in index['entries']}
paths=[RUN/'artifact-binding.json',D/'candidate_manifest.json',D/C['archive'],RUN/'bind-artifacts.py']
for folder in ['install-lifecycle','batch-witnesses']:
 paths.extend(p for p in (RUN/'local'/folder).rglob('*') if p.is_file() and p.suffix in ['.json','.log','.sh'])
paths.extend(RUN/'local'/n for n in ['install-lifecycle.py','batch-witnesses.cjs'])
for p in paths:entries[p.relative_to(R).as_posix()]={'path':p.relative_to(R).as_posix(),'sha256':sha(p),'scope':'Local raw artifact with exact byte binding; distinguish finite counterexample observations from configured scoring.'}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps({'archive_sha256':C['sha256'],'matched_files':len(contents),'images':list(image_results),'index_entries':len(entries)}))

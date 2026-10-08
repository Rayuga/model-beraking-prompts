from pathlib import Path
import hashlib, json, subprocess, time
RUN=Path(__file__).resolve().parent; ROOT=RUN.parents[2]
M=json.loads((RUN/'manifest.json').read_text())
OUT=RUN/'local/uncached-agent-load-inspection'; OUT.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
code="""const fs=require('fs'),path=require('path'),crypto=require('crypto');
const files={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
walk('/instructions');walk('/assets');
const initialAppFiles=fs.readdirSync('/app');const express=require('express'),app=express();app.use(express.json());if(typeof app.get!=='function')throw new Error('Express factory did not load');
const DB=require('better-sqlite3'),db=new DB(':memory:');db.exec('CREATE TABLE witness(value INTEGER); INSERT INTO witness VALUES(42)');
const value=db.prepare('SELECT value FROM witness').get().value;db.close();
fs.writeFileSync('/app/provisioning-probe','ok');
console.log(JSON.stringify({initial_app_files:initialAppFiles,express_factory_loaded:typeof express==='function',node:process.version,express:require('express/package.json').version,sqlite:require('better-sqlite3/package.json').version,native_sqlite_value:value,app_writable:fs.readFileSync('/app/provisioning-probe','utf8')==='ok',files}));"""
image='hireops-agent:20261001-hard-r3-uncached'
cmd=['docker','run','--rm','--network','none','--entrypoint','node',image,'-e',code]
start=time.monotonic();p=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8')
(OUT/'run.log').write_text(p.stdout+p.stderr,encoding='utf-8')
assert p.returncode==0,p.stderr
result=json.loads(p.stdout)
assert result['express']=='5.1.0' and result['sqlite']=='12.4.1'
assert result['native_sqlite_value']==42 and result['app_writable']
expected={'/'+k.removeprefix('environment/'):v for k,v in M['inputs']['task'].items() if k.startswith(('environment/instructions/','environment/assets/'))}
assert result['files']==expected
record={'input_sha256':M['input_sha256'],'image':image,'image_id':json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]['Id'],'command':cmd,'exit_code':p.returncode,'duration_seconds':time.monotonic()-start,'observations':result,'log_sha256':sha(OUT/'run.log'),'scope':'Actual uncached agent image dependency/native-SQLite and staging probe only; existing base image, no full build registry download or provider/app grade.'}
(OUT/'results.json').write_text(json.dumps(record,indent=2)+'\n')
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={e['path']:e for e in index['entries']}
for path in [Path(__file__),*OUT.iterdir(),RUN/'local/uncached-build/agent.json',RUN/'local/uncached-build/agent.log']:
    entries[path.relative_to(ROOT).as_posix()]={'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'scope':record['scope']}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps({'exit_code':p.returncode,'image_id':record['image_id'],'matched_staged_files':len(expected),'indexed_artifacts':len(entries)}))

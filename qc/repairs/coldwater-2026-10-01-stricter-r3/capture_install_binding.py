from pathlib import Path
import hashlib, json, subprocess

here = Path(__file__).resolve().parent
app = Path('projects/colderwater-playground-devtools/solution/app')
container = 'cw-history-r3b-golden'
def command(args):
    result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8')
    return {'command': args, 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
code = """const fs=require('node:fs'),crypto=require('node:crypto');const hashes={};function walk(base,rel=''){for(const e of fs.readdirSync(base+'/'+rel,{withFileTypes:true})){const p=(rel?rel+'/':'')+e.name;if(e.isDirectory()){if(e.name!=='.git')walk(base,p);}else hashes[p]=crypto.createHash('sha256').update(fs.readFileSync(base+'/'+p)).digest('hex');}}walk('/app');console.log(JSON.stringify({hashes,cwd:fs.readlinkSync('/proc/1/cwd'),cmdline:fs.readFileSync('/proc/1/cmdline','utf8'),db:process.env.DB_PATH,node:process.version,sqlite:require('better-sqlite3/package.json').version,sqliteResolved:require.resolve('better-sqlite3'),localDeps:fs.existsSync('/app/node_modules')}));"""
inspection = command(['docker','exec',container,'node','-e',code])
runtime = json.loads(inspection['stdout'])
expected = {p.relative_to(app).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in app.rglob('*') if p.is_file()}
report = {'scope':'Actual solve.sh copies the complete solution into an exact-current environment image; server starts from /tmp. Scripted installation proof, not configured Oracle.',
          'container':container, 'inspection':inspection,'runtime':runtime,'expected_solution_hashes':expected,
          'all_solution_files_match':all(runtime['hashes'].get(p)==v for p,v in expected.items()),
          'health':command(['docker','exec',container,'node','-e',"fetch('http://localhost:3000/api/health').then(async r=>console.log(r.status,await r.text()))"]),
          'logs':command(['docker','logs',container]),
          'image':command(['docker','image','inspect','qc-coldwater-history:r3','--format','{{.Id}}'])}
report['passed']=report['all_solution_files_match'] and not runtime['localDeps'] and runtime['cwd']=='/tmp' and report['health']['stdout'].startswith('200 ')
(here/'full-install-binding.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'passed':report['passed'],'file_count':len(expected),'cwd':runtime['cwd'],'sqliteResolved':runtime['sqliteResolved']}))

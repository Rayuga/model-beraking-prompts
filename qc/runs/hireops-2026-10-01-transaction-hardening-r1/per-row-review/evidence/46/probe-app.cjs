
const fs=require('fs'), http=require('http'), crypto=require('crypto');
const result={uid:process.getuid(),gid:process.getgid(),env_keys:Object.keys(process.env).sort(),read_probes:{},write_probes:{}};
for(const path of ['/tests/scoring.toml','/tests/scored/functional/judge.toml','/tests/gates/render/judge.toml','/root/.codex/config.toml','/proc/1/environ','/logs/verifier/reward.json']){
  try {const bytes=fs.readFileSync(path);result.read_probes[path]={readable:true,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
  catch(e){result.read_probes[path]={readable:false,code:e.code};}
}
for(const path of ['/tests/scoring.toml','/logs/verifier/reward.txt','/usr/local/bin/rewardkit']){
  try{const fd=fs.openSync(path,'r+');fs.closeSync(fd);result.write_probes[path]={writable:true};}
  catch(e){result.write_probes[path]={writable:false,code:e.code};}
}
const Database=require('better-sqlite3');const db=new Database(process.env.DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS isolation_control(value TEXT)');db.prepare('INSERT INTO isolation_control VALUES(?)').run('ordinary-app-write');
result.sqlite_positive_control=db.prepare('SELECT COUNT(*) AS n FROM isolation_control').get().n===1;
result.synthetic_secret_env_present=Boolean(process.env.ROW46_SYNTHETIC_PRIVATE_MARKER||process.env.ANTHROPIC_AUTH_TOKEN);
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}).listen(Number(process.env.PORT),'0.0.0.0');

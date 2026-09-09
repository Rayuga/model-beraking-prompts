const fs = require('node:fs');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const results = [];
assert(fs.statSync('/etc/ssl/certs/ca-certificates.crt').size > 0);
const download = spawnSync('curl', ['--fail','--silent','--show-error','--location',
  '--max-time','30','--output','/dev/null','--write-out','%{http_code}',
  'https://astral.sh/uv/install.sh'], {encoding:'utf8'});
assert.equal(download.status, 0, download.stderr);
assert.equal(download.stdout, '200');
results.push({name:'CA bundle and secure HTTPS bootstrap URL',passed:true,http_status:200,installer_executed:false});
assert.equal(require('express/package.json').version, '5.1.0');
assert.equal(require('better-sqlite3/package.json').version, '12.4.1');
const db = require('better-sqlite3')(':memory:');
assert.equal(db.prepare('SELECT 1 as ok').get().ok,1);
db.close();
results.push({name:'Express and native SQLite available in the agent image',passed:true});
assert(fs.existsSync('/assets/artifacts/common_ground_seed.json'));
assert(fs.existsSync('/assets/starter/server.js'));
assert(fs.existsSync('/instructions/runtime.md'));
assert(!fs.existsSync('/tests'));
assert(!fs.existsSync('/solution'));
results.push({name:'Inputs and starter staged; no solution or verifier directory in agent image',passed:true});
const result={results,provider_calls:0};
fs.writeFileSync('/results/agent-preflight.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

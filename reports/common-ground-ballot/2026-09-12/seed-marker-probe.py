import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

source = Path('/submission')
results = []
for marker in (True, False):
    work = Path(tempfile.mkdtemp(prefix='ballot-seed-probe-'))
    for name in ('database.js', 'common_ground_seed.json'):
        shutil.copyfile(source / name, work / name)
    if marker:
        shutil.copyfile(source / '.seed-applied', work / '.seed-applied')
    script = """
const mod = require('./database');
mod.initializeDatabase();
const Db = require('better-sqlite3');
const db = new Db(process.env.DB_PATH, {readonly:true});
const count = db.prepare('SELECT count(*) AS n FROM users').get().n;
console.log(JSON.stringify({users:count,correctRuthLogin:Boolean(mod.authenticateUser('ruth.adebayo@commonground.example','CommonGround!2026'))}));
db.close();
"""
    p = subprocess.run(['node','-e',script],cwd=work,
        env=dict(os.environ,DB_PATH=str(work/'fresh.db')),capture_output=True,text=True,timeout=25)
    assert p.returncode == 0, p.stderr
    data = json.loads(p.stdout)
    assert data == ({'users':0,'correctRuthLogin':False} if marker else {'users':4,'correctRuthLogin':True}), data
    results.append({'seed_marker_present':marker,'fresh_database':True,**data})
report = {'passed':True,'scope':'Direct initialization/authentication probe in disposable container copies; not an HTTP or browser rerun.',
          'original_artifact_unchanged':True,'results':results}
Path('/results/haiku-seed-marker-reproduction.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

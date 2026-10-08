import hashlib,json,zipfile,subprocess
from pathlib import Path
bundle=Path('/candidate/hireops-recruiting-operations.zip');manifest=json.loads(Path('/candidate/candidate_manifest.json').read_text());assert hashlib.sha256(bundle.read_bytes()).hexdigest()==manifest['sha256']
target=Path('/tmp/hireops-extracted')
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 assert all(n.startswith('hireops-recruiting-operations/') and '..' not in Path(n).parts for n in z.namelist())
 z.extractall(target)
task=target/'hireops-recruiting-operations'
actual={p.relative_to(task).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in task.rglob('*') if p.is_file()};assert actual==manifest['source_sha256']
driver=Path('/evidence/batch-domain.cjs').read_text().replace('/solution',str(task/'solution')).replace('/evidence/batch-domain','/evidence/archive-batch-domain')
Path('/tmp/archive-domain.cjs').write_text(driver)
r=subprocess.run(['node','/tmp/archive-domain.cjs'],capture_output=True,text=True,timeout=60)
Path('/evidence/archive-check.log').write_text(r.stdout+r.stderr)
Path('/evidence/archive-check.json').write_text(json.dumps({'archive_sha256':manifest['sha256'],'extracted_hashes_match':True,'extracted_files':len(actual),'batch_domain_exit':r.returncode,'scope':'Executed all15 coordinated domain groups from actual extracted ZIP; no configured judge grade.'},indent=2))
print(r.stdout);assert r.returncode==0,r.stderr

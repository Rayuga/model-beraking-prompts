from pathlib import Path
import hashlib,json,tomllib,zipfile
root=Path(__file__).resolve().parents[3];run=root/'qc/runs/coldwater-2026-09-30-repair3'
m=json.loads((run/'manifest.json').read_text());task=root/m['task'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
current={p.relative_to(task).as_posix():sha(p) for p in task.rglob('*') if p.is_file()}
assert current==m['inputs']['task']
r=json.loads((run/'golden/run-golden-20260930-092021/RESULTS.json').read_text())
for rel,h in r['actual_app_files'].items():assert sha(task/'solution/app'/rel)==h
assert r['passed'] and r['functional_passed'] and len(r['fresh_fact_keys'])==64 and not r['missing_fact_keys'] and not r['failed_fact_keys']
assert len(r['surface']['checks'])==9 and all(x['pass'] for x in r['surface']['checks'].values())
assert len(r['surface']['runtime_edges']['results'])==11 and all(x['passed'] for x in r['surface']['runtime_edges']['results'])
shared=['task.toml','environment/Dockerfile','tests/Dockerfile','tests/test.sh','tests/scoring.toml','tests/tools/score.py','tests/tools/restart_mcp.py']
old=root/'.qc-cache/coldwater-2026-09-30-hardening/task'
assert all((task/f).read_bytes()==(old/f).read_bytes() for f in shared)
reports=['targeted-runtime-confirmation.json','targeted-boundary-confirmation.json','targeted-coverage-confirmation.json']
for f in reports:assert json.loads((run/f).read_text())['input_sha256']==m['input_sha256']
record={'input_sha256':m['input_sha256'],'current_task_matches_frozen':True,'task_files':len(current),'golden_app_matches_current':True,'functional_passed':64,'gates_passed':2,'polish_passed':7,'extra_runtime_passed':11,'canonical_policy_preserved':{f:sha(task/f) for f in shared},'targeted_confirmation_sha256':{f:sha(run/f) for f in reports},'golden_result_sha256':sha(run/'golden/run-golden-20260930-092021/RESULTS.json'),'new_zip_created':False,'full_qc_clearance':False,'oracle_score_measured':False,'target_model_score_measured':False}
(run/'final-binding.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['current_task_matches_frozen','task_files','golden_app_matches_current','functional_passed','gates_passed','polish_passed','extra_runtime_passed','new_zip_created','full_qc_clearance']}))

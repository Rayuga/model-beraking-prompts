"""Hash-bind reusable raw evidence by actual exercised scope, not invented full-run clearance."""
from pathlib import Path
import hashlib,json
root=Path.cwd();run=root/'qc/runs/hireops-2026-10-01-round7';base=root/'qc/runs/hireops-2026-10-01-repairs'
manifest=json.loads((run/'manifest.json').read_text());current=manifest['inputs']['task']
def read(rel):return json.loads((base/rel).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def match(record,files,prefix=''):
    differences={f:dict(recorded=record.get(f),current=current.get(prefix+f)) for f in files if record.get(f)!=current.get(prefix+f)}
    assert not differences,differences
    return {prefix+f:current[prefix+f] for f in files}
ui=read('ui-recovery/results.json');ui_scope=match(ui['source'],list(ui['source']),prefix='solution/app/')
backend=[p for p in current if p.startswith('solution/app/src/') or p=='solution/app/server.js']
domain=read('domain-seed/results.json');domain_scope=match(domain['source'],backend)
runtime=read('runtime/coverage/source-before.json')
runtime_scope=match(runtime,[p for p in current if (p.startswith('solution/') or p in {'tests/test.sh','tests/tools/restart_mcp.py','tests/tools/score.py','tests/scoring.toml','tests/Dockerfile'})])
recovery=read('runtime/recovery-mcp/evidence-classification.json')
recovery_scope=match(recovery['source_hashes'],list(recovery['source_hashes']))
entries=[
 ('runtime/recovery-mcp/mcp/results.json','Seven actual Linux MCP observations of own offer approval/fresh Auditor readback and bounded request interruption/retained rescission date/retry; current rubric execution and configured judging are NOT claimed',recovery_scope),
 ('ui-recovery/results.json','16 local browser observations including exact large-money UI preservation, complete compensation display and revision error figures',ui_scope),
 ('domain-seed/results.json','77 local HTTP/domain observations; reuse only unchanged backend. Frontend/docs/criteria are not covered by this older run.',domain_scope),
 ('runtime/coverage/mcp/results.json','Seven actual Linux Chromium/Playwright-MCP and restart observations; external synthetic RewardKit transport supplied dummy scores. No configured judge.',runtime_scope),
 ('runtime/schema-round7/discovery/results.json','Real installed RewardKit 0.1.7 loader, prompt/schema and command construction for88 criteria; no provider invoked',{p:current[p] for p in current if p.startswith('tests/')}),
 ('runtime/round7-images.json','Exact current frozen agent input and verifier runtime file hashes in actual images',{}),
 ('review-fixes/static-coverage.json','Reuse unchanged shell/JavaScript syntax only from this earlier record; current run preflight.json covers current source. Neither is private portal checking',{}),
 ('runtime/resistant-process/restart-result.json','Raw deliberate-resistant-process probe of unchanged canonical restart helper; not a HireOps product defect',{}),
 ('runtime/scored-failure-configured/result.json','Raw synthetic evaluator-failure test of unchanged canonical harness metadata; no app/model grade',{}),
 ('health/final/results.json','Actual Node22 health/install probes; inspect health/manifest.json for exercised-file bindings',{}),
 ('witnesses-final/SUMMARY.json','Six local source-mutation witness cases; no empirical configured rewards or ranking',{}),
]
data={'input_sha256':manifest['input_sha256'],'classification':'Supplementary raw evidence inventory. Each reviewer must inspect scripts/raw logs and relevant hash scope independently. This is not runtime-evidence.json or release clearance.','entries':[{'path':str((base/p).relative_to(root)).replace('\\','/'),'sha256':sha(base/p),'scope':scope,'matching_source_files':binding} for p,scope,binding in entries], 'required_unmeasured':['full configured Oracle/judge launch and grading','configured judge workload duration','empirical partial-app reward discrimination/ranking','target Luna builder and resulting app scores'],'current_candidate_note':'Only canonical task files belong to candidate. Proposed shared-harness patches under canonical-proposal are UNAPPLIED and must not be credited as current fixes.'}
(run/'raw-evidence-index.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
for reviewer in range(1,4):
    p=run/f'reviewer-{reviewer}.md';s=p.read_text()
    if 'raw-evidence-index.json' not in s:s+='\nSupplementary raw evidence: read this run\'s `raw-evidence-index.json`, then the relevant scripts and logs. It describes scope/hashes, not clearance. Do not read historical/peer reviewer reports. Proposed shared-harness patches remain unapplied; grade the frozen task. Snapshot directory `task` is an implementation detail: use manifest logical slug `hireops-recruiting-operations` for naming checks.\n';p.write_text(s,encoding='utf-8')
print('Raw evidence bound to',manifest['input_sha256'])

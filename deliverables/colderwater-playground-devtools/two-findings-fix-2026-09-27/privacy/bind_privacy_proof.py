from pathlib import Path
import hashlib
import json
import tomllib

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
TASK=ROOT/'projects/colderwater-playground-devtools'
sha=lambda b:hashlib.sha256(b).hexdigest()
r=json.loads((HERE/'privacy_results.json').read_text())
current=next(c for c in tomllib.loads((TASK/'tests/scored/functional/judge.toml').read_text())['criterion'] if c['id']=='cw_runtime_files_not_publicly_exposed')
paths=['/app.db','/app.db-wal','/app.db-shm','/server.js','/package.json','/package-lock.json','/npm-shrinkwrap.json','/.git/config','/.git/HEAD']
checks=[]
def check(name,value,evidence=None):checks.append({'name':name,'passed':bool(value),'evidence':evidence})
check('Actual installed MCP proof passed',r['passed'],{'mcp':r['mcp_version'],'chromium':r['chromium_version']})
check('Current privacy criterion equals frozen tested criterion',current==r['protocol_criterion'] and current==json.loads((HERE/'frozen_privacy_criterion.json').read_text()),sha(current['description'].encode()))
check('Protocol remained unchanged during probe',r['protocol_unchanged_during_probe'])
check('All eight cases attempted all nine candidates in order',len(r['cases'])==8 and all([x['candidate'] for x in c['observations']]==paths for c in r['cases']))
check('Every case has before and after actual authored Run controls',all(c['initialControl']['preview'] and c['initialControl']['console'] and c['finalControl']['preview'] and c['finalControl']['console'] for c in r['cases']))
cases={c['name']:c for c in r['cases']}
negative=cases['deny_only_old_three']['observations']
check('Negative fixture rejects three exposed benign files',set(x['candidate'] for x in negative if x['outcome']=='file_download')=={'/.git/config','/app.db-wal','/package-lock.json'})
check('Negative fixture would satisfy only the former three-address probe',all(x['outcome']=='denied_or_missing' for x in negative if x['candidate'] in ['/app.db','/server.js','/package.json']))
check('Golden denies all nine paths',all(x['status']==404 and x['outcome']=='denied_or_missing' for x in cases['golden']['observations']))
check('Ordinary denial and no-content controls pass',all(x['outcome']=='denied_or_missing' for x in cases['ordinary_denial']['observations']) and all(x['status']==204 and x['outcome']=='no_content' for x in cases['no_content']['observations']))
check('All SPA and redirect fallbacks remain working editors',all(x['outcome']=='working_playground_fallback' and x['fallbackControl']['preview'] and x['fallbackControl']['console'] for name in ['working_spa','redirect_to_workspace'] for x in cases[name]['observations']))
overlap=next(x for x in cases['public_asset_name_overlap']['observations'] if x['candidate']=='/server.js')
check('Genuine overlapping public script is accepted',overlap['status']==200 and overlap['observedAsBrowserAsset'] and overlap['outcome']=='observed_public_browser_asset',overlap)
check('403 attachment-header responses remain denial',all(x['status']==403 and x['outcome']=='denied_or_missing' for x in cases['denial_with_attachment']['observations']),{'actual_download_events':sum(len(x['downloads']) for x in cases['denial_with_attachment']['observations'])})
check('Golden source bytes remain unchanged',all((TASK/'solution/app'/name).is_file() and sha((TASK/'solution/app'/name).read_bytes())==h for name,h in r['source_sha256'].items()))
probe=(HERE/'privacy-probe.js').read_text()
check('Browser probe has no response/download body readers or source classifier',not any(s in probe for s in ['response.body(', 'response.text(', 'response.json(', '.createReadStream(', '.saveAs(', 'classifier']), 'Manual read confirms innerHTML occurs only in the deliberately authored working-control snippet, not a private-body read.')
artifact_hashes={p.name:sha(p.read_bytes()) for p in HERE.iterdir() if p.is_file() and p.name in ['privacy-fixtures.cjs','privacy-probe.js','privacy-proof.py','privacy_results.json','frozen_privacy_criterion.json','attempt1_tool_setup_error.json']}
result={'passed':all(x['passed'] for x in checks),'checks':checks,'criterion_sha256':sha(current['description'].encode()),'current_judge_sha256':sha((TASK/'tests/scored/functional/judge.toml').read_bytes()),'artifacts':artifact_hashes,'execution_scope':'8 actual installed-MCP cases, 72 candidate navigations, 16 before/after authored Runs plus 18 SPA/redirect fallback Runs; no model verdicts or paid platform calls.','no_task_edits':True,'limitations':['Denial-with-attachment produced no actual Chromium download event; the established-denial plus simultaneous-download ordering is source-reviewed, not empirically triggered.','The first attempt failed only in local URL helper setup; its report is retained and is not product failure evidence.','Public role established only through permitted browser observations; no private content inspected.','This bounded sample does not establish exhaustive absence of all disclosure routes.']}
(HERE/'privacy_binding.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'checks':len(checks),'criterion_sha256':result['criterion_sha256']}))
assert result['passed']

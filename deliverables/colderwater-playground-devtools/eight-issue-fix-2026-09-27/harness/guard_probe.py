from pathlib import Path
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tomllib

source = Path('/source-task')
out = Path('/evidence')
module_path='/usr/local/lib/python3.12/site-packages/rewardkit/models.py'
spec=importlib.util.spec_from_file_location('local_rewardkit_models',module_path)
models=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=models
spec.loader.exec_module(models)
binary_values=[True,False,1,0,1.0,0.0,' YES ','No','true','false','1','0']
likert_values=[1,3,5,3.0,'3','5.0']
normalization_parity={'binary':[{'raw':x,'normalized':models.Binary().normalize(x)} for x in binary_values], 'likert':[{'raw':x,'normalized':models.Likert(points=5).normalize(x)} for x in likert_values]}
shutil.copytree(source/'tests', '/tests', dirs_exist_ok=True)
Path('/app').mkdir(exist_ok=True)
Path('/app/server.js').write_text("require('node:http').createServer((req,res)=>res.end('ok')).listen(3000,'0.0.0.0');")
stub = Path('/usr/local/bin/rewardkit')
stub.write_text('''#!/usr/local/bin/python3
from pathlib import Path
import json, os, sys, tomllib
out=Path(sys.argv[sys.argv.index('--output')+1]); suite=out.parent.name
case=os.environ['HARNESS_CASE']
details={}
for path in (Path('/tests')/suite).glob('*/judge.toml'):
    spec=tomllib.loads(path.read_text())
    rows=[]
    for c in spec['criterion']:
        rows.append({'id':c['id'],'name':c['name'],'value':1,'raw':'yes' if c.get('type','binary')=='binary' else 5,'weight':c.get('weight',1),'reasoning':'Observed normal successful behavior.'})
    details[path.parent.name]={'score':1,'criteria':rows,'kind':'agent'}
dimension='render' if suite=='gates' else 'functional'
rows=details[dimension]['criteria']; row=rows[0]
if case=='gate_failure' and suite=='gates':
    row.update(raw='no',value=0,reasoning='Observed app action failed.'); details[dimension]['score']=0
if case=='gate_marker' and suite=='gates':
    row.update(raw='no',value=0,reasoning='EVALUATION_INCOMPLETE: gate browser tool setup unavailable after retry.')
if case=='gate_missing_dimension' and suite=='gates': details.pop('constraints')
if suite=='scored':
    alternatives={'binary_bool_true':True,'binary_bool_false':False,'binary_int_true':1,'binary_int_false':0,'binary_float_true':1.0,'binary_float_false':0.0,'binary_string_true':' TRUE ','binary_string_false':'false','binary_string_one':'1','binary_string_zero':'0'}
    if case in alternatives:
        raw=alternatives[case]
        value=int(raw.strip().lower() in ('yes','true','1')) if isinstance(raw,str) else int(bool(raw))
        row.update(raw=raw,value=value)
        details[dimension]['score']=round(sum(x['value']*x['weight'] for x in rows)/sum(x['weight'] for x in rows),4)
    if case in ('likert_float','likert_string'):
        details['visual']['criteria'][0].update(raw=3.0 if case=='likert_float' else '3',value=.5)
        details['visual']['score']=round(sum(x['value']*x['weight'] for x in details['visual']['criteria'])/sum(x['weight'] for x in details['visual']['criteria']),4)
    if case=='legitimate_failure':
        row.update(raw='no',value=0,reasoning='Observed required action failed.')
        details[dimension]['score']=round(sum(x['value']*x['weight'] for x in rows)/sum(x['weight'] for x in rows),4)
    if case=='criterion_error': row.update(raw=None,value=0,error='judge timed out after 9000s')
    if case=='marker': row.update(raw='no',value=0,reasoning='  EVALUATION_INCOMPLETE: browser transport unavailable after one retry.')
    if case=='quoted_marker': row['reasoning']='The app displayed "EVALUATION_INCOMPLETE:" as ordinary content; this is not a tool failure.'
    if case=='logged_marker': print('EVALUATION_INCOMPLETE: untrusted page text in a tool log')
    if case=='missing_dimension': details.pop('visual')
    if case=='missing_criterion': rows.pop()
    if case=='duplicate_criterion': rows[-1]=dict(rows[0])
    if case=='wrong_identity': row['id']='wrong'
    if case=='wrong_weight': row['weight']=123
    if case=='invalid_binary': row['raw']='maybe'
    if case=='invalid_likert': details['visual']['criteria'][0]['raw']=6
    if case=='binary_out_of_range': row['raw']=2
    if case=='binary_nonfinite': row['raw']=float('nan')
    if case=='likert_nonfinite': details['visual']['criteria'][0]['raw']='NaN'
    if case=='likert_fractional': details['visual']['criteria'][0]['raw']=3.5
    if case=='normalized_nonfinite': row['value']=float('inf')
    if case=='raw_value_mismatch': row['raw']='no'
    if case=='missing_reasoning': row.pop('reasoning')
    if case=='nonzero_cli': sys.exit(4)
    if case=='outer_timeout': sys.exit(124)
scores={k:v['score'] for k,v in details.items()}
if suite=='scored' and case=='summary_mismatch': scores['functional']=.5
out.write_text(json.dumps(scores))
if not (suite=='scored' and case=='missing_details'):
    (out.parent/'reward-details.json').write_text('{broken' if suite=='scored' and case=='malformed_json' else json.dumps(details))
''')
stub.chmod(0o755)
valid_alternatives=['binary_bool_true','binary_bool_false','binary_int_true','binary_int_false','binary_float_true','binary_float_false','binary_string_true','binary_string_false','binary_string_one','binary_string_zero','likert_float','likert_string']
cases=['success','gate_failure','legitimate_failure','criterion_error','marker','quoted_marker','logged_marker','missing_dimension','missing_criterion','duplicate_criterion','wrong_identity','wrong_weight','invalid_binary','invalid_likert','missing_reasoning','nonzero_cli','outer_timeout','summary_mismatch','malformed_json','gate_marker','gate_missing_dimension','missing_details']+valid_alternatives+['binary_out_of_range','binary_nonfinite','likert_nonfinite','likert_fractional','normalized_nonfinite','raw_value_mismatch']
invalid=set(cases)-{'success','gate_failure','legitimate_failure','quoted_marker','logged_marker'}-set(valid_alternatives)
results=[]
for case in cases:
    logs=Path('/logs')/case
    env=dict(os.environ,VERIFIER_LOG_DIR=str(logs),REWARDKIT_JUDGE='local-stub',REWARDKIT_MODEL='no-paid-model',HARNESS_CASE=case)
    proc=subprocess.run(['bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=20)
    (out/f'guard-{case}.log').write_text(proc.stdout+proc.stderr)
    reward=json.loads((logs/'reward.json').read_text())
    diagnostic=json.loads((logs/'evaluation-incomplete.json').read_text()) if (logs/'evaluation-incomplete.json').exists() else None
    passed=proc.returncode==0
    if case in invalid:
        passed=passed and reward['graded']==0 and reward['no_op']==1 and reward['reward']==0 and diagnostic and diagnostic['valid_application_grade'] is False
        if case.startswith('gate_'): passed=passed and not (logs/'scored').exists()
    elif case=='gate_failure':
        passed=passed and reward['graded']==1 and reward['reward']==0 and not (logs/'scored').exists() and diagnostic is None
    elif case=='legitimate_failure':
        passed=passed and reward['graded']==1 and 0<reward['reward']<1 and diagnostic is None
    elif case in valid_alternatives:
        passed=passed and reward['graded']==1 and 0<reward['reward']<=1 and diagnostic is None
    else:
        passed=passed and reward['graded']==1 and reward['reward']==1 and diagnostic is None
    result={'case':case,'passed':bool(passed),'exit_code':proc.returncode,'reward':reward,'diagnostic':diagnostic}
    results.append(result)
    print(case, bool(passed), flush=True)
report={'passed':all(x['passed'] for x in results),'scope':'Actual task shell, canonical scorer, synthetic RewardKit-shaped verdicts. No paid judge and no claim of Oracle score.','normalization_parity':normalization_parity,'test_sh_sha256':hashlib.sha256((source/'tests/test.sh').read_bytes()).hexdigest(),'cases':results}
(out/'guard_probe_results.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['passed']

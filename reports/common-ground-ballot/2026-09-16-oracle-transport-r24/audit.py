from pathlib import Path
import hashlib
import json
import re
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
RUNS=ROOT/'run-outputs/common-ground-ballot'
TASK=ROOT/'projects/common-ground-ballot'
with zipfile.ZipFile(ROOT/'deliverables/common-ground-ballot/2026-09-16-budget-revision-r23/common-ground-ballot.zip') as archive:
    baseline={info.filename.split('/',1)[1]:archive.read(info) for info in archive.infolist()}
helpers={name:(body+'\n').encode() for name,marker,body in re.findall(r"cat > /opt/common-ground-verifier/([^ ]+) <<'(COMMON_GROUND_HELPER_\d+)'\n([\s\S]*?)\n\2\n",baseline['tests/test.sh'].decode())}
rows=[]
for result_path in sorted(RUNS.glob('run-*/common-ground-ballot__*/result.json')):
    trial=result_path.parent
    result=json.loads(result_path.read_text(encoding='utf-8'))
    agent=result.get('config',{}).get('agent',{})
    reward_file=trial/'verifier/reward.json'
    scores=json.loads(reward_file.read_text()) if reward_file.exists() else None
    details_file=trial/'verifier/reward-details.json'
    details=json.loads(details_file.read_text()) if details_file.exists() else {}
    failures={dim:[{'id':c['id'],'value':c['value'],'reasoning':c.get('reasoning')} for c in value.get('criteria',[]) if c['value']<1] for dim,value in details.items() if isinstance(value,dict) and value.get('score',1)<1}
    provenance_file=trial/'verifier/prompt-provenance.json'
    provenance=json.loads(provenance_file.read_text()) if provenance_file.exists() else {}
    matches={}
    for dim,info in provenance.get('judges',{}).items():
        for filename,key in [('judge.toml','judge_sha256'),('prompt.md','prompt_sha256')]:
            name=f'tests/{dim}/{filename}'
            matches[name]=hashlib.sha256(baseline[name]).hexdigest()==info[key]
    for name,key in [('tests/test.sh','runner_sha256'),('tests/reward.toml','reward_sha256')]:
        if key in provenance:matches[name]=hashlib.sha256(baseline[name]).hexdigest()==provenance[key]
    for name,digest in provenance.get('resource_sha256',{}).items():
        matches['private/'+name]=name in helpers and hashlib.sha256(helpers[name]).hexdigest()==digest
    golden={}
    if agent.get('name')=='oracle':
        for path in (TASK/'solution').rglob('*'):
            if path.is_file() and path.name!='solve.sh':
                artifact=trial/'artifacts/app'/path.relative_to(TASK/'solution')
                golden[path.relative_to(TASK/'solution').as_posix()]=artifact.exists() and artifact.read_bytes()==path.read_bytes()
    timing={}
    for path in (trial/'verifier/judges').glob('*/attempt-*/timing.json'):
        data=json.loads(path.read_text());timing[path.parents[1].name]={'elapsed_sec':data.get('elapsed_sec'),'returncode':data.get('returncode'),'status':data.get('status')}
    row={'trial':trial.name,'run':trial.parent.name,'agent':agent.get('name'),'model':agent.get('model_name'),'scores':scores,
         'exception':({key:result['exception_info'].get(key) for key in ('exception_type','occurred_at')} if result.get('exception_info') else None),'failures':failures,'timing':timing,'provenance_matches_frozen_r23':matches,'golden_matches':golden}
    rows.append(row)
    print(json.dumps({k:v for k,v in row.items() if k not in ('failures','golden_matches','provenance_matches_frozen_r23')},ensure_ascii=False))
    print('Failure counts:',{dim:len(values) for dim,values in failures.items()},'provenance_match:',all(matches.values()) if matches else None,'golden_match:',all(golden.values()) if golden else None)
    if agent.get('name')=='oracle':
        trace=[]
        for path in sorted((trial/'verifier/judges/functional').glob('*/events.jsonl')):
            for line in path.read_text().splitlines():
                event=json.loads(line);item=event.get('item',{})
                if event.get('type')=='item.completed' and item.get('type') in ('mcp_tool_call','command_execution'):
                    data={'at':event.get('_trace_elapsed_sec'),'type':item['type'],'tool':item.get('tool'),'arguments':item.get('arguments'),'command':item.get('command'),'error':item.get('error'),'result':item.get('result'),'output':item.get('aggregated_output')}
                    trace.append(data)
                    if data['error']:print(json.dumps({'at':data['at'],'tool':data['tool'],'error':data['error']},ensure_ascii=False)[:500])
        (HERE/'oracle-functional-tools.json').write_text(json.dumps(trace,indent=2)+'\n',encoding='utf-8')
(HERE/'run-audit.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')

from pathlib import Path
import hashlib,json,tomllib

root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
task=root/'projects/dropline-four-connect'
source=out/'source-before-hardening'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
rows=[]
for trial in sorted((root/'run-outputs/dropline-four-lite').rglob('dropline-four-connect__*')):
    if not trial.is_dir() or not (trial/'result.json').exists():continue
    cfg=read(trial/'config.json'); result=read(trial/'result.json'); reward=read(trial/'verifier/reward.json')
    agent=cfg.get('agent',{})
    row={'run':trial.parent.name,'trial':trial.name,'path':str(trial.relative_to(root)),
         'agent':agent.get('name') or agent.get('import_path') or result.get('agent_info',{}).get('name'),'model':agent.get('model_name'),
         'reward':reward,'exception':result.get('exception_info'),'failures':[]}
    details_path=trial/'verifier/reward-details.json'
    if details_path.exists():
        details=read(details_path)
        for dim,info in details.items():
            if not isinstance(info,dict):continue
            for c in info.get('criteria',[]):
                if c.get('value',1)<1:
                    row['failures'].append({'dimension':dim,'id':c['id'],'value':c.get('value'),'reason':c.get('reasoning')})
        current={c['id']:c for c in tomllib.loads((task/'tests/functional/judge.toml').read_text())['criterion']}
        actual=details.get('functional',{}).get('criteria',[])
        row['functional_criteria_match_source']=len(actual)==len(current) and all(c['id'] in current and c.get('description','').strip()==current[c['id']]['description'].strip() and c['weight']==current[c['id']]['weight'] for c in actual)
    rows.append(row)
report={'runs':rows,'source_baseline':{p.relative_to(source).as_posix():sha(p) for p in source.rglob('*') if p.is_file()},
        'historical_zip_sha256':sha(root/'deliverables/dropline-four-connect/1.0.0-name-20260913/dropline-four-connect.zip')}
(out/'run-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
for r in rows:print(r['trial'],r['agent'],r['model'],r['reward']['reward'],'criterion match',r.get('functional_criteria_match_source'))

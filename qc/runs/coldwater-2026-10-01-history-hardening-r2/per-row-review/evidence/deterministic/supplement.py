import hashlib,json,re,subprocess,sys,tomllib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[6]
OUT=Path(__file__).parent
RUN=ROOT/'qc/runs/coldwater-2026-10-01-history-hardening-r2'
TASK=ROOT/'.qc-cache/coldwater-2026-10-01-history-hardening-r2/task'
index=json.loads((RUN/'raw-evidence-index.json').read_text())
hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h for p,h in index['artifacts'].items()}
binding=json.loads((ROOT/'qc/repairs/coldwater-2026-10-01-stricter-r2/full-install-binding.json').read_text())
solution={p.relative_to(TASK/'solution/app').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (TASK/'solution/app').rglob('*') if p.is_file()}
bound={p:binding['runtime']['hashes'].get(p)==h for p,h in solution.items()}
assert all(hashes.values()) and all(bound.values())
public=[TASK/'instruction.md',*TASK.glob('environment/instructions/*.md')]
descriptions=[c['description'] for p in TASK.glob('tests/*/*/judge.toml') for c in tomllib.loads(p.read_text())['criterion']]
overlaps=[]
for p in public:
    words=re.findall(r'[\w/-]+',p.read_text().lower())
    windows={' '.join(words[i:i+12]) for i in range(len(words)-11)}
    for i,d in enumerate(descriptions):
        dw=re.findall(r'[\w/-]+',d.lower())
        shared=windows & {' '.join(dw[n:n+12]) for n in range(len(dw)-11)}
        if shared: overlaps.append({'path':p.relative_to(TASK).as_posix(),'criterion_index':i,'overlaps':sorted(shared)})
names=['QC Save Alpha','QC Save Beta','QC Concurrent Save','QC Reverse Draft','QC Reverse Winner','QC Version Sketch','QC History Unsaved','QC Restart Primary','CW gate ','user-edited-preview-741','network-control-','history-A','history-B','history-C','object-check','nested-value']
corpus=[*TASK.glob('environment/assets/*'),*(TASK/'solution/app').rglob('*')]
name_hits={n:[p.relative_to(TASK).as_posix() for p in corpus if p.is_file() and n in p.read_text(encoding='utf-8')] for n in names}
report={'index_sha256':hashlib.sha256((RUN/'raw-evidence-index.json').read_bytes()).hexdigest(),'input_sha256':index['input_sha256'],'all_index_hashes_match':all(hashes.values()),'artifact_count':len(hashes),'all_15_solution_files_match_runtime_binding':all(bound.values()),'source_file_count':len(bound),'12_word_public_criterion_overlaps':overlaps,'distinctive_phrase_matches':name_hits,'runtime_evidence_record_exists':(RUN/'runtime-evidence.json').exists(),'limitations':'Index and full-install logs are scripted product evidence, not configured judge timing, Oracle score, discrimination, ranking, or portal checkers.'}
(OUT/'supplement-observations.json').write_text(json.dumps(report,indent=2)+'\n')
scorer=TASK/'tests/tools/score.py'
cases=[('gate-fail',{'render':0,'constraints':1},{'functional':1,'polish':1,'visual':1},1,0),('all-pass',{'render':1,'constraints':1},{'functional':1,'polish':1,'visual':1},0,1),('floor-boundary',{'render':1,'constraints':1},{'functional':0.05,'polish':1,'visual':1},0,0),('partial',{'render':1,'constraints':1},{'functional':0.5,'polish':0.5,'visual':0.5},0,0.5),('invalid-value',{'render':1,'constraints':1},{'functional':True,'polish':1,'visual':1},2,None)]
results=[]
for name,gates,scored,exit_want,reward_want in cases:
    dest=OUT/'synthetic-scorer'/name
    (dest/'gates').mkdir(parents=True,exist_ok=True)
    (dest/'scored').mkdir(exist_ok=True)
    (dest/'gates/reward.json').write_text(json.dumps(gates))
    (dest/'scored/reward.json').write_text(json.dumps(scored))
    command=[sys.executable,'-B',str(scorer),str(dest)]
    run=subprocess.run(command,capture_output=True,text=True)
    record=json.loads((dest/'reward.json').read_text()) if (dest/'reward.json').exists() else None
    passed=run.returncode==exit_want and (reward_want is None or record['reward']==reward_want)
    results.append({'name':name,'command':command,'exit_code':run.returncode,'stdout':run.stdout,'stderr':run.stderr,'result':record,'expected_exit':exit_want,'expected_reward':reward_want,'passed':passed})
assert all(r['passed'] for r in results)
(OUT/'scorer-synthetic-results.json').write_text(json.dumps({'scope':'actual shared scorer on synthetic dimension inputs; not model/app score evidence','results':results},indent=2)+'\n')
print(json.dumps(report,indent=2)); print('SYNTHETIC_SCORER_CASES',[(r['name'],r['passed']) for r in results])

from pathlib import Path
import hashlib
import json
import re
import tomllib
import zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'
REF=ROOT/'projects/bazaarbridge-marketplace-commerce'
archive_path=OUT/'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    files={n.split('/',1)[1]:archive.read(n) for n in archive.namelist()}
source={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert files==source
read=lambda name:files[name].decode('utf-8')
parsed=lambda name:tomllib.loads(read(name))
cfg=parsed('task.toml')
ref=tomllib.loads((REF/'task.toml').read_text(encoding='utf-8'))
def keys(value,prefix=''):
    result=set()
    for key,item in value.items():
        result.add(prefix+key)
        if isinstance(item,dict):result.update(keys(item,prefix+key+'.'))
    return result
checks=[]
def check(name,passed,evidence):
    assert passed,name
    checks.append({'check':name,'status':'pass','evidence':evidence})
check('Exact task.toml key paths',keys(cfg)==keys(ref),'No extra or missing keys, including nested metadata.')
check('Reference timeouts',all(cfg[section][key]==ref[section][key] for section,key in [('agent','timeout_sec'),('verifier','timeout_sec'),('environment','build_timeout_sec')]),'Agent 7200; verifier 13200; build 600 seconds.')
check('Version',cfg['task']['version']==ref['task']['version']=='1.0.0','Literal 1.0.0 matches the reference file.')
check('Exact verifier.env',cfg['verifier']['env']==ref['verifier']['env'],'All keys and values match the supplied Bazaarbridge reference.')
for name in ('tests/Dockerfile','tests/test.sh','environment/Dockerfile'):
    check(name+' API-key mention exclusion',not re.search(r'(?:OPENAI|OPENROUTER)[ _-]*API[ _-]*KEY',read(name),re.I),'No matches anywhere in the file.')
check('Reasoning effort max','model_reasoning_effort = "max"' in read('tests/Dockerfile'),'Explicit Codex config written by verifier Dockerfile.')
formula='''if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]'''
check('Exact final reward formula',formula in read('tests/test.sh'),'Exact requested form, without an ungated intermediate.')
dims=('render','constraints','functional','polish','visual')
judges=sorted(name for name in files if name.endswith('/judge.toml'))
check('Five verifier folders',judges==sorted(f'tests/{dim}/judge.toml' for dim in dims),'Actual reference directory spelling is tests/, not test/.')
for dim in dims:
    name=f'tests/{dim}/judge.toml'
    data=parsed(name)
    check(dim+' judge keys',not(set(data['judge'])&{'judge','model'}),'The required [judge] table exists; forbidden judge/model keys do not.')
    check(dim+' comment headers',not any(line.lstrip().startswith('#') for line in read(name).splitlines()),'No TOML comment lines.')
    prompt=read(f'tests/{dim}/prompt.md')
    check(dim+' browser gate',bool(re.search(r'Global browser gate:',prompt,re.I)) and bool(re.search(r'assign\s+(?:0|no)\s+to\s+(?:every|all)',prompt,re.I)),'Explicit global browser gate and zero-on-failure rule.')
budget=sum(parsed(f'tests/{dim}/judge.toml')['judge']['timeout'] for dim in dims)
check('Nested verifier budget',budget==12000<12600<cfg['verifier']['timeout_sec'],'12000 total judge seconds < 12600 wrapper < 13200 verifier.')
weight_ref=ROOT/'projects/docketlight-claims-insurance'
check('User-approved Docketlight judge weights',all(parsed(f'tests/{dim}/judge.toml')['judge']['weight']==tomllib.loads((weight_ref/f'tests/{dim}/judge.toml').read_text(encoding='utf-8'))['judge']['weight'] for dim in dims),'Functional/Polish/Visual 0.6/0.2/0.2; Render/Constraints 1.0. This is the later user-approved override to Bazaarbridge weights.')
report={'zip_sha256':hashlib.sha256(archive_path.read_bytes()).hexdigest(),'zip_matches_current_source':True,'manual_checks':checks,'manual_checklist_status':'pass','platform_rubric_status':'not certified locally','remaining_rubric_risks':[
    'Polish/Visual credit for weak or nonfunctional submissions remains possible; prior Haiku trial had Functional 0 and overall 0.3033. User deferred score-floor changes and kept Visual appearance-only.',
    'RewardKit 0.1.7 includes positive Render/Constraints judge weights in its intermediate aggregate; test.sh overwrites it with the gated final formula. Docketlight alignment does not remove this distinction.',
    'Previously reviewed assumptions such as wrapped-line navigation and the Polish error-observation procedure remain deferred; the platform semantic review may raise them.'
]}
(OUT/'manual-qc-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
lines=['# Latest PatchPad ZIP manual QC audit','','All supplied manual-checklist requirements pass on the actual ZIP, which exactly matches the current source.','','| Check | Status | Evidence |','| --- | --- | --- |']
lines += [f"| {item['check']} | Pass | {item['evidence']} |" for item in checks]
lines += ['','ZIP SHA-256: `'+report['zip_sha256']+'`.','','Platform rubric QC is not certified by this local checklist. Remaining risks:','']
lines += ['- '+risk for risk in report['remaining_rubric_risks']]
(OUT/'MANUAL_QC_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({key:value for key,value in report.items() if key not in ('manual_checks','remaining_rubric_risks')},indent=2))
print('PASS',len(checks),'archive audit checks; all manual checklist items pass.')

import hashlib,json,re,sys
from pathlib import Path
root=Path('/tests')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
record={'task':'common-ground-ballot','task_version':'1.0.0','judges':{}}
for d in ('render','constraints','functional','polish','visual'):
    p=root/d/'prompt.md'; text=p.read_text()
    versions=re.findall(r'^Prompt version: (.+)$',text,re.M)
    assert re.findall(r'^Task version: (.+)$',text,re.M)==['1.0.0']
    assert len(versions)==1 and re.fullmatch('common-ground-ballot-'+d+r'-v1\.0\.0-r[1-9]\d*',versions[0])
    record['judges'][d]={'prompt_version':versions[0],'prompt_sha256':sha(p),'judge_sha256':sha(root/d/'judge.toml')}
record['runner_sha256']=sha(root/'test.sh');record['reward_sha256']=sha(root/'reward.toml');record['score_sha256']=sha(root/'score.py')
if __name__ == '__main__':
    Path(sys.argv[1]).write_text(json.dumps(record,indent=2)+'\n')
    print('Prompt provenance: '+json.dumps(record,sort_keys=True),flush=True)

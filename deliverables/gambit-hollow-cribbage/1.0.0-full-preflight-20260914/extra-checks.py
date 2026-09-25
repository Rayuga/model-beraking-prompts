from pathlib import Path
from html.parser import HTMLParser
import hashlib,itertools,json,re,subprocess,sys,tomllib,zipfile

OUT=Path(__file__).resolve().parent
TASK=OUT/'extracted-final/gambit-hollow-cribbage'
results=[]
def check(name,value):
    assert value,name
    results.append({'name':name,'passed':True})

class Markup(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.scripts=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='script' and a.get('src'):self.scripts.append(a['src'])
page=Markup();page.feed((TASK/'solution/www/index.html').read_text('utf-8'))
check('Golden HTML IDs unique',len(page.ids)==len(set(page.ids)))
check('All browser script paths exist',all((TASK/'solution/www'/n.lstrip('/')).is_file() for n in page.scripts))
appcode='\n'.join(p.read_text('utf-8') for p in (TASK/'solution/www/js').glob('*.js'))
literal_ids=set(re.findall(r"\$\('([^']+)'\)",appcode))
check('All literal DOM references resolve',literal_ids<=set(page.ids))
for p in TASK.rglob('*'):
    if not p.is_file():continue
    if p.suffix in ('.js','.html','.css','.toml','.sh') or p.name=='Dockerfile':
        s=p.read_text('utf-8')
        pattern=r'^\s*(?://|/\*|<!--)'
        if p.suffix in ('.sh','.toml') or p.name=='Dockerfile':pattern=r'^\s*#(?!\!)'
        check('No code/config comment lines '+p.relative_to(TASK).as_posix(),not re.search(pattern,s,re.M))
    if p.suffix=='.js':
        relative=p.relative_to(TASK)
        mapped='/app/'+relative.relative_to('solution').as_posix() if relative.parts[0]=='solution' else '/assets/club/scored-hands.js'
        r=subprocess.run(['docker','exec','gambit-final-preflight-20260914','node','--check',mapped],capture_output=True,text=True)
        check('Node syntax '+relative.as_posix(),r.returncode==0)
for n in ('test.sh','app-lifecycle.sh'):
    r=subprocess.run(['docker','exec','gambit-final-preflight-20260914','bash','-n','/tests/'+n],capture_output=True,text=True)
    check('Shell syntax '+n,r.returncode==0)

provenance=json.loads((OUT/'runner-logs/prompt-provenance.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for d,record in provenance['judges'].items():
    check('Executed prompt hash equals packaged '+d,record['prompt_sha256']==sha(TASK/f'tests/{d}/prompt.md'))
    check('Executed judge hash equals packaged '+d,record['judge_sha256']==sha(TASK/f'tests/{d}/judge.toml'))
check('Executed runner hash equals packaged',provenance['runner_sha256']==sha(TASK/'tests/test.sh'))
check('Executed reward config hash equals packaged',provenance['reward_config_sha256']==sha(TASK/'tests/reward.toml'))

runner=(TASK/'tests/test.sh').read_text('utf-8')
validator=runner.split("<<'PY'\n")[-1].split('\nPY\n')[0]
normal=dict(render=1,constraints=1,functional=.5,polish=.8,visual=.3)
cases=[('weighted',normal,.52),('partial positive render',{**normal,'render':.1},.52),('partial positive constraints',{**normal,'constraints':.1},.52),('zero render',{**normal,'render':0},0),('zero constraints',{**normal,'constraints':0},0),('all full',dict.fromkeys(normal,1),1),('all zero',dict.fromkeys(normal,0),0)]
for label,value in [('negative',-.1),('over one',1.01),('NaN',float('nan')),('positive infinity',float('inf')),('negative infinity',-float('inf')),('boolean',True),('numeric string','1'),('null',None),('array',[]),('object',{})]:cases.append((label,{**normal,'functional':value},None))
for key in normal:cases.append(('missing '+key,{k:v for k,v in normal.items() if k!=key},None))
reward_cases=[]
directory=OUT/'reward-validation';directory.mkdir(exist_ok=True)
for i,(label,data,expected) in enumerate(cases):
    jf=directory/f'{i}.json';tf=directory/f'{i}.txt';cf=directory/f'{i}-ctrf.json';jf.write_text(json.dumps(data))
    r=subprocess.run([sys.executable,'-c',validator,str(jf),str(tf),str(cf)],capture_output=True,text=True)
    if expected is None:passed=r.returncode!=0
    else:passed=r.returncode==0 and json.loads(jf.read_text())['reward']==expected and float(tf.read_text())==expected and json.loads(cf.read_text())['summary']['total']==5
    check('Actual reward validator: '+label,passed)
    reward_cases.append({'case':label,'passed':passed,'expected':expected if expected is not None else 'reject before scoring'})
(OUT/'reward-validator-results.json').write_text(json.dumps(reward_cases,indent=2)+'\n')
fixture_command="console.log(JSON.stringify(require('/assets/club/scored-hands.js').SCORED_HANDS))"
fixture_process=subprocess.run(['docker','exec','gambit-final-preflight-20260914','node','-e',fixture_command],capture_output=True,text=True,check=True)
fixtures=json.loads(fixture_process.stdout)
independent=[]
for f in fixtures:
    hand,cut=f['hand'],f['cut'];cards=hand+[cut]
    ranks=['A23456789TJQK'.index(c[0])+1 for c in cards]
    fifteens=2*sum(sum(min(x,10) for x in combo)==15 for length in range(2,6) for combo in itertools.combinations(ranks,length))
    pairs=2*sum(a==b for a,b in itertools.combinations(ranks,2))
    runs=0
    for length in (5,4,3):
        runs=length*sum(len(set(c))==length and max(c)-min(c)==length-1 for c in itertools.combinations(ranks,length))
        if runs:break
    flush=0
    if len({c[1] for c in hand})==1:
        flush=5 if cut[1]==hand[0][1] else 0 if f['crib'] else 4
    nobs=int(any(c[0]=='J' and c[1]==cut[1] for c in hand))
    total=fifteens+pairs+runs+flush+nobs
    assert total==f['total'],(f,total)
    independent.append({'hand':hand,'cut':cut,'crib':f['crib'],'expected':f['total'],'independent_total':total,'breakdown':dict(fifteens=fifteens,pairs=pairs,runs=runs,flush=flush,nobs=nobs)})
check('Independent Python enumeration verifies all 40 supplied hand totals',len(independent)==40)
(OUT/'independent-fixture-audit.json').write_text(json.dumps(independent,indent=2)+'\n')
check('Baseline all browser groups passed',all(x['passed'] for x in json.loads((OUT/'browser-results.json').read_text())['results']))
check('Baseline all unit groups passed',all(x['passed'] for x in json.loads((OUT/'unit-results.json').read_text())['results']))
check('Complete runner negative cases pass',all(x['passed'] for x in json.loads((OUT/'negative-runner-results.json').read_text())['results']))
(OUT/'extra-checks.json').write_text(json.dumps({'checks':results,'passed':True},indent=2)+'\n')
print('PASS',len(results),'additional syntax, DOM, provenance and reward checks;',len(cases),'reward validation cases')

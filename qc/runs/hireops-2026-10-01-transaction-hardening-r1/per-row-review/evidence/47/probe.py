"""Finite dependency/date inspection for row 47; never executes a provider judge."""
from pathlib import Path
import hashlib
import json
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r1'
FROZEN = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r1'
OUT = Path(__file__).resolve().parent
IMAGE = 'sha256:a6e377e2468671fe2b676f3d211ca5c0cfdc4b68a98cffd1349b332ed59c6251'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
shared = {}
for rel in ['tests/Dockerfile','tests/test.sh','tests/tools/score.py','tests/tools/restart_mcp.py']:
    task = FROZEN/'task'/rel
    template = FROZEN/'rules/projects/webdev-task-template'/rel
    shared[rel] = {'task_sha256':sha(task), 'template_sha256':sha(template), 'identical':task.read_bytes()==template.read_bytes()}
task_config=tomllib.loads((FROZEN/'task/task.toml').read_text())
template_config=tomllib.loads((FROZEN/'rules/projects/webdev-task-template/task.toml').read_text())
judges=[]
for p in sorted((FROZEN/'task/tests').glob('*/*/judge.toml')):
    judge=tomllib.loads(p.read_text())['judge']
    judges.append({'path':str(p.relative_to(FROZEN/'task')), 'judge':judge, 'sha256':sha(p)})
inspection=RUN/'local/configured-inspection/results.json'
source_binding={rel:sha(FROZEN/'task/tests'/rel)==h for rel,h in json.loads(inspection.read_text())['tests_sha256'].items()}
index=json.loads((RUN/'raw-evidence-index.json').read_text())
needed={'local/configured-inspection/results.json','local/inspect-configured.py','local/build-verifier.log'}
artifacts={}
for entry in index['entries']:
    if any(entry['path'].endswith('/'+x) for x in needed):
        p=ROOT/entry['path']; actual=sha(p)
        artifacts[entry['path']]={'sha256':actual,'index_match':actual==entry['sha256']}
inner=r'''
from pathlib import Path
import hashlib,json,subprocess,importlib.metadata
def command(args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=30)
 return {'args':args,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
result={'kind':'Finite installed dependency/browser and explicit-date computations; NO provider grade',
        'versions':[command(['claude','--version']),command(['codex','--version']),command(['playwright-mcp','--version']),command(['chromium','--version'])],
        'rewardkit':importlib.metadata.version('harbor-rewardkit')}
mcp=Path('/usr/local/lib/node_modules/@playwright/mcp')
result['mcp_package']=json.loads((mcp/'package.json').read_text())
result['playwright_package']=json.loads((mcp/'node_modules/playwright/package.json').read_text())
core=mcp/'node_modules/playwright-core'
result['browsers']=json.loads((core/'browsers.json').read_text())
result['baked_sources']={str(p.relative_to('/tests')):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}
code=r"""
const R=require('/task/solution/app/src/rules');
const seed=require('/task/solution/app/src/seed_data.json');
const RealDate=Date;
const starts=['2026-02-01T00:00:00Z','2026-02-01T00:00:00.001Z','2026-01-31T12:00:00Z','2026-09-15T00:00:00Z'];
function referral(start,at) { return R.referralVested({referred_hire_start:start,total_cents:1000000,at_hire_cents:500000,contingent_cents:500000},at); }
const cases=[['2024-02-29T12:34:56.789Z','2025-02-28T12:34:56.788Z'],['2024-02-29T12:34:56.789Z','2025-02-28T12:34:56.789Z'],['2024-01-31T12:00:00Z','2025-03-30T12:00:00Z'],['2024-01-01T00:00:00Z','2026-01-01T00:00:00Z'],['2024-01-01T00:00:00Z','2026-09-01T00:00:00Z'],['2026-01-01T00:00:00Z','2025-01-01T00:00:00Z']];
const variants=[];
for(const tz of ['UTC','Pacific/Kiritimati','America/Los_Angeles']) for(const wall of ['2020-01-01T00:00:00Z','2030-12-31T00:00:00Z']) {
 process.env.TZ=tz;
 global.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[wall]));} static now(){return RealDate.parse(wall);} };
 variants.push({tz,wall,referrals:starts.map(s=>referral(s,seed.reference_moment)),vesting:cases.map(([start,at])=>({months:R.completedMonths(start,at),signing:R.signingClawback({start_date:start,signing_bonus_cents:10001},at),equity:R.equityCancellation({grant_date:start,units:7},at)}))});
}
global.Date=RealDate;
const broken_wall_clock=starts.map(s=>referral(s,'2026-10-01T00:00:00Z').vested_cents);
console.log(JSON.stringify({reference:seed.reference_moment,variants,broken_wall_clock,expected_referrals:[1000000,500000,1000000,500000],expected_months:[11,12,13,24,32,0]}));
"""
probe=command(['node','-e',code]); result['date_command']=probe
if probe['returncode']==0: result['date_results']=json.loads(probe['stdout'])
print(json.dumps(result))
'''
command=['docker','run','--rm','--network','none','--name','hireops-row47-dependency-clock','--mount',f'type=bind,source={FROZEN / "task"},target=/task,readonly','-i',IMAGE,'python3','-']
runtime=subprocess.run(command,input=inner,text=True,capture_output=True,timeout=90)
record={'input_sha256':'6e0b8d2fb655781b3dbd8f4bde8d064dd48f8f7671ecd87f6a2db22b5c0aa8a1','scope':'Finite local source/version/date checks only; no configured score, no private checker execution','command':command,'image':IMAGE,'returncode':runtime.returncode,'stderr':runtime.stderr,'shared':shared,'verifier_env_identical':task_config['verifier']['env']==template_config['verifier']['env'],'judges':judges,'prior_inspection_source_binding':source_binding,'verified_artifacts':artifacts,'driver_sha256':sha(Path(__file__))}
if runtime.returncode==0:
    record['runtime']=json.loads(runtime.stdout)
    dates=record['runtime'].get('date_results')
    if dates:
        record['date_invariance']=all(x['referrals']==dates['variants'][0]['referrals'] and x['vesting']==dates['variants'][0]['vesting'] for x in dates['variants'])
        record['date_expected_match']=all([r['vested_cents'] for r in x['referrals']]==dates['expected_referrals'] and [r['months'] for r in x['vesting']]==dates['expected_months'] for x in dates['variants'])
    record['image_source_binding']={rel:sha(FROZEN/'task/tests'/rel)==h for rel,h in record['runtime']['baked_sources'].items()}
else: record['stdout']=runtime.stdout
(OUT/'results.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:record[k] for k in ['returncode','verifier_env_identical','date_invariance','date_expected_match'] if k in record}))
print('shared_identical',all(v['identical'] for v in shared.values()))
print('prior_inspection_sources_match',all(source_binding.values()))
print('image_sources_match',all(record.get('image_source_binding',{}).values()))
print('evidence_sha256',sha(OUT/'results.json'))
if runtime.returncode: print(runtime.stderr,runtime.stdout)

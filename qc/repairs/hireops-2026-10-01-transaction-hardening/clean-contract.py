from pathlib import Path
import re,json,hashlib,tomllib,sys
R=Path(__file__).resolve().parents[3];T=R/'projects/hireops-recruiting-operations/hireops-recruiting-operations'
def edit(p,a,b):
 q=T/p;s=q.read_text(encoding='utf-8');assert a in s,(p,a);q.write_text(s.replace(a,b),encoding='utf-8',newline='\n')
edit('tests/scored/functional/prompt.md','Account, role, tier/band, identity-policy, anonymous-read-screen and dashboard-transition criteria','Role, tier/band, anonymous-read-family and coordinated-change criteria')
edit('tests/gates/constraints/judge.toml','a uniquely named requisition with an ordinary nonblank ID, a title','a uniquely named requisition with a stable generated or entered ID, a title')
edit('tests/gates/constraints/judge.toml','individual-account support has scored credit','observe available working intake independently of account-specific permissions')
edit('tests/scored/functional/judge.toml','with a fresh unused ID and without','with a fresh unique title (and unused ID if the UI accepts one) and without')
edit('tests/scored/functional/judge.toml','with a fresh offer ID and without','with a fresh candidate (and unused ID if the UI accepts one) and without')
edit('tests/scored/functional/judge.toml','Record all seeded IDs/counts plus these saved details','Record any imported operational seed IDs/counts plus these saved details')
# The two confidentiality owners must not both deduct for one batch receipt leak.
edit('tests/scored/functional/judge.toml','P9 confidentiality of Audit Trail and available action receipts:','P9 confidentiality of ordinary Audit Trail and individual approval/revision/rescission receipts (coordinated batch previews/receipts belong only to hro_anon_read_changes):')
# Packaging is task-specific count validation, not shared scoring/harness policy.
p=R/'deliverables/package_staged_candidates.py';s=p.read_text(encoding='utf-8').replace("'hireops-recruiting-operations': (145, 45)","'hireops-recruiting-operations': (133, 45)").replace("'hireops-recruiting-operations': 14","'hireops-recruiting-operations': 4").replace("assert dimensions['visual']['criteria'] == 6","assert dimensions['visual']['criteria'] == (5 if task.name == 'hireops-recruiting-operations' else 6)");p.write_text(s,encoding='utf-8',newline='\n')
# The old browser driver is retained untouched. Adapt a copy solely for removed theme/dashboard scope.
s=(R/'scripts/check_hireops_ui.cjs').read_text(encoding='utf-8').replace("const root = path.resolve(__dirname, '..');","const root = '/work';").replace("name: 'Dashboard', exact: true","name: 'Coordinated Changes', exact: true")
a=s.index("  await page.locator('#theme-toggle').click();");b=s.index("  await nav('Requisitions');",a);s=s[:a]+s[b:]
a=s.index('  await page.setViewportSize({ width: 390');b=s.index("  await login('recruiter');",a);s=s[:a]+s[b:]
(Path(__file__).parent/'legacy-ui.cjs').write_text(s,encoding='utf-8',newline='\n')
sys.path.insert(0,str(R/'scripts'));import qc_pipeline
out=qc_pipeline.preflight(T,R/qc_pipeline.TEMPLATE)
cs=[c for p in (T/'tests').glob('*/*/judge.toml') for c in tomllib.loads(p.read_text(encoding='utf-8'))['criterion']];ids={c['id'] for c in cs}
refs=set()
for p in (T/'tests').rglob('*'):
 if p.is_file() and p.suffix in ['.md','.toml']:refs.update(re.findall(r'\bhro_[a-z0-9_]+\b',p.read_text(encoding='utf-8')))
out['dangling']=sorted(refs-ids)
(Path(__file__).parent/'structural-authoring.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))

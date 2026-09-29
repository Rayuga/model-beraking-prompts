from pathlib import Path
ROOT=Path.cwd()
OUT=Path(__file__).resolve().parent/'harness'
OLD=ROOT/'deliverables/ridgeline-print-storefront/cross-check-2026-09-27/harness'
fixtures=OUT/'fixtures'
fixtures.mkdir(exist_ok=True)
for name in ['harness_boot.sh','relative_server.js']:
    (fixtures/name).write_bytes((OLD/name).read_bytes())
boot=(fixtures/'harness_boot.sh').read_text()
boot=boot.replace("result=json.loads((root/'reward.json').read_text())", "result=json.loads((root/'reward.json').read_text())\nfor diagnostic in [root/'evaluation-incomplete.json',*root.glob('*/rewardkit.log')]:\n if diagnostic.exists(): print(diagnostic.name,diagnostic.read_text())")
(fixtures/'harness_boot.sh').write_text(boot,encoding='utf-8',newline='\n')
stub=(OLD/'harness_rewardkit_stub.py').read_text()
stub=stub.replace('import sys\n','import sys\nimport tomllib\n')
needle="out.write_text(json.dumps(data))"
replacement='''out.write_text(json.dumps(data))
details={}
for path in (Path('/tests')/suite).glob('*/judge.toml'):
    spec=tomllib.loads(path.read_text()); value=data[path.parent.name]
    rows=[{'id':c['id'],'name':c['name'],'weight':c.get('weight',1),'value':value,'raw':('yes' if value else 'no') if c['type']=='binary' else 5,'reasoning':'Synthetic transport only; app evidence is recorded separately.'} for c in spec['criterion']]
    details[path.parent.name]={'score':value,'criteria':rows}
(out.parent/'reward-details.json').write_text(json.dumps(details))'''
assert needle in stub
stub=stub.replace(needle,replacement)
snapshot="""        def all_stock():
            return {p['sku']+':'+v['size']:v['in_stock'] for p in request('/api/prints')['prints'] for v in p['sizes']}
        snapshot=all_stock()
        historical=request('/api/orders/RP-100001')
"""
stub=stub.replace("        assert before['total_pence'] == 3970\n", "        assert before['total_pence'] == 3970\n"+snapshot)
stub=stub.replace("        assert after == before\n", "        assert after == before\n        assert all_stock()==snapshot and len(snapshot)==13\n        assert request('/api/orders/RP-100001')==historical\n")
(fixtures/'harness_rewardkit_stub.py').write_text(stub,encoding='utf-8',newline='\n')
runner=(ROOT/'deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/harness/run_orchestration_regressions.py').read_text()
runner=runner.replace("FIXTURES = ROOT/'deliverables/ridgeline-print-storefront/cross-check-2026-09-27/harness'", "FIXTURES = HERE/'fixtures'")
runner=runner.replace('ridgeline-second-harness-','ridgeline-final-harness-').replace('ridgeline-verifier:20260927-crosscheck','ridgeline-verifier:20260927-second-crosscheck')
(OUT/'run_orchestration_regressions.py').write_text(runner,encoding='utf-8')
print(fixtures)

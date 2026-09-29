"""Independent arithmetic from the public seed; does not import golden pricing code."""
import hashlib, json, sys, tomllib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
TASK=ROOT/'projects/ridgeline-print-storefront'
seed=json.loads((TASK/'environment/assets/seed_data.json').read_text())
variants={(v['sku'],v['size']):v for v in seed['variants']}
weights={v['size']:v['grams'] for v in seed['size_weights']}
cases=[]
def quote(lines):
    gross=charged=grams=0
    for sku,size,qty in lines:
        v=variants[(sku,size)]
        gross+=qty*v['price_pence']
        charged+=qty*(v['tier_price_pence'] if qty>=v['tier_qty'] else v['price_pence'])
        grams+=qty*weights[size]
    band=next((b for b in sorted(seed['postage_bands'],key=lambda b:b['up_to_grams']) if b['up_to_grams']>0 and grams<=b['up_to_grams']),next(b for b in seed['postage_bands'] if b['up_to_grams']==0))
    return {'gross':gross,'saving':gross-charged,'grams':grams,'postage':band['price_pence'],'total':charged+band['price_pence'],'collection':band['up_to_grams']==0}
def check(name,lines,expected):
    actual=quote(lines)
    assert all(actual[k]==v for k,v in expected.items()),(name,actual,expected)
    cases.append({'name':name,'lines':lines,'expected':expected,'actual':actual,'passed':True})
check('two Night Ferry A2',[('RP-108','A2',2)],{'gross':12900,'saving':0,'postage':320,'total':13220})
check('trade size isolation below threshold',[('RP-108','A3',4),('RP-108','A2',1)],{'gross':23450,'saving':0,'postage':495,'total':23945})
check('trade size isolation at threshold',[('RP-108','A3',5),('RP-108','A2',1)],{'gross':27700,'saving':3125,'postage':495,'total':25070})
check('90g band',[('RP-103','A3',1)],{'grams':90,'postage':175,'total':4425})
check('500g inclusive',[('RP-103','A3',2),('RP-101','A2',2)],{'grams':500,'postage':320})
check('2000g inclusive',[('RP-103','A3',8),('RP-101','A2',4),('RP-108','A2',4)],{'grams':2000,'postage':495,'collection':False})
check('2090g collection',[('RP-103','A3',9),('RP-101','A2',4),('RP-108','A2',4)],{'grams':2090,'postage':0,'collection':True})
check('regular one A3',[('RP-101','A3',1)],{'gross':3795,'saving':0,'postage':175,'total':3970})
check('mixed trade',[('RP-101','A3',2),('RP-105','A3',1),('RP-106','A3',5)],{'gross':32635,'saving':3125,'postage':495,'total':30005})
check('Two Weathers A2 authoritative',[('RP-106','A2',1)],{'gross':6450,'saving':0,'postage':320,'total':6770})
check('combined five Nine Windows',[('RP-103','A3',5)],{'gross':21250,'saving':3125,'postage':320,'total':18445})
check('eight Harbour A3',[('RP-102','A3',8)],{'gross':30360,'saving':3040,'postage':495,'total':27815})
check('Night Ferry A2 retry',[('RP-108','A2',1)],{'gross':6450,'saving':0,'postage':320,'total':6770})
check('Night Ferry A3 cancellation',[('RP-108','A3',5)],{'gross':21250,'saving':3125,'postage':320,'total':18445})
check('Slack A3 conditional price setup',[('RP-104','A3',2)],{'gross':7590,'saving':0,'postage':320,'total':7910})
check('Slack A2 last unit',[('RP-104','A2',1)],{'gross':5650,'saving':0,'postage':320,'total':5970})
check('Long Field A2 first order',[('RP-101','A2',2)],{'gross':11300,'saving':0,'postage':320,'total':11620})
check('Long Field A2 second order',[('RP-101','A2',3)],{'gross':16950,'saving':1725,'postage':320,'total':15545})
history=seed['orders'][0]
assert history['reference']=='RP-100001' and history['status']=='dispatched'
assert history['lines'][0]['qty']*history['lines'][0]['unit_price_pence']==history['subtotal_pence']==7000
assert history['subtotal_pence']-history['trade_saving_pence']+history['postage_pence']==history['total_pence']==7320
stock={key:v['in_stock'] for key,v in variants.items()}
ledger=[]
def movement(name,lines):
    for sku,size,delta in lines:
        stock[(sku,size)]+=delta
        assert stock[(sku,size)]>=0,(name,sku,size,stock[(sku,size)])
    ledger.append({'name':name,'stock':{sku+' '+size:n for (sku,size),n in stock.items()}})
movement('constraints',[('RP-105','A3',-1)])
movement('historical comparison',[('RP-101','A3',-1)])
movement('mixed',[('RP-101','A3',-2),('RP-105','A3',-1),('RP-106','A3',-5)])
movement('two valid address controls',[('RP-105','A3',-2)])
movement('authoritative positive plus accepted authoritative reprice branch',[('RP-106','A2',-2)])
movement('combined quantities controls',[('RP-103','A3',-6)])
movement('stale multiline positive',[('RP-102','A3',-8)])
movement('retry plus genuine new',[('RP-108','A2',-2)])
movement('cancel positive',[('RP-108','A3',-5)])
movement('cancel restores once',[('RP-108','A3',5)])
movement('concurrency setup plus one winner',[('RP-104','A3',-2)])
assert stock[('RP-104','A3')]==0 and stock[('RP-104','A2')]==1
slack=[v for v in seed['variants'] if v['sku']=='RP-104']
correct=min(v['price_pence'] for v in slack)
incorrect=min(v['price_pence'] for v in slack if stock[(v['sku'],v['size'])]>0)
assert correct==3795 and incorrect==5650
movement('last A2',[('RP-104','A2',-1)])
movement('successive orders',[('RP-101','A2',-5)])
assert stock[('RP-105','A3')]==3
movement('restart cancelled control purchase',[('RP-105','A3',-1)])
movement('restart cancelled control return',[('RP-105','A3',1)])
movement('restart placed control',[('RP-105','A3',-1)])
assert stock[('RP-105','A3')]==2
judges={p.relative_to(TASK).as_posix():tomllib.loads(p.read_text()) for p in TASK.glob('tests/*/*/judge.toml')}
functional=judges['tests/scored/functional/judge.toml']['criterion']
assert len(functional)==25 and abs(sum(c['weight'] for c in functional)-35)<1e-9
assert sum(len(d['criterion']) for d in judges.values())==37
output={'passed':True,'arithmetic_cases':cases,'historical_receipt_checked':True,'normal_stock_ledger':ledger,'reprice_rejection_branch':'Two Weathers A2 remains two rather than one; no later setup consumes this variant.','new_grid_counterexample':{'correct_offered_minimum':correct,'wrong_available_only_minimum':incorrect,'A3_stock':0,'A2_stock':1},'functional_count':len(functional),'functional_weight':sum(c['weight'] for c in functional),'all_criteria':37,'actual_browser_run':False,'paid_provider':False}
(OUT/'semantic-arithmetic-results.json').write_text(json.dumps(output,indent=2)+'\n')
owned=['tests/scored/functional/judge.toml','tests/scored/functional/prompt.md','tests/scored/polish/judge.toml','tests/scored/polish/prompt.md','task.toml']
(OUT/'semantic-source-binding.json').write_text(json.dumps({p:hashlib.sha256((TASK/p).read_bytes()).hexdigest() for p in owned},indent=2)+'\n')
print(json.dumps({'passed':True,'arithmetic_cases':len(cases),'stock_transitions':len(ledger),'functional_count':25,'functional_weight':35,'total_criteria':37}))

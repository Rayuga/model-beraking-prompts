from pathlib import Path
import http.cookiejar, json, urllib.request, uuid

base='http://localhost:3000'
jar=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,body=None):
    headers={'Content-Type':'application/json','Idempotency-Key':str(uuid.uuid4())}
    req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    with opener.open(req,timeout=10) as r:return r.status,json.load(r)
def candidate(id='CAND-101'):
    return request('/api/candidates/'+id)[1]
assert request('/api/login',{'email':'panel1@pellmoor.test','password':'password123'})[0]==200
results=[]
for value in [True,[3],'4']:
    before=candidate();revision=before['vacancy']['revision']
    status,_=request('/api/candidates/CAND-101/scores',{'score':value,'revision':revision})
    after=candidate()
    assert status==200 and after['vacancy']['revision']==revision+1
    results.append(dict(probe='non-number JSON score',input=value,status=status,before_revision=revision,after_revision=after['vacancy']['revision'],product_state_changed=True))
for extra in [{'revision_as_string':True},{'capacity':999}]:
    before=candidate();revision=before['vacancy']['revision']
    body={'body':'Targeted local diagnostic','revision':str(revision) if 'revision_as_string' in extra else revision}
    if 'capacity' in extra:body['capacity']=extra['capacity']
    status,_=request('/api/candidates/CAND-101/notes',body)
    after=candidate();assert status==200 and after['vacancy']['revision']==revision+1
    results.append(dict(probe='numeric-string JSON revision' if 'revision_as_string' in extra else 'client-supplied capacity field',status=status,before_revision=revision,after_revision=after['vacancy']['revision'],product_state_changed=True))
assert request('/api/login',{'email':'hiring@pellmoor.test','password':'password123'})[0]==200
before=candidate('CAND-102');revision=before['vacancy']['revision']
status,_=request('/api/candidates/CAND-102/stage',{'target':'interview','revision':revision})
after=candidate('CAND-102')
new=[e for e in after['candidate']['activity'] if e['id'] not in {e['id'] for e in before['candidate']['activity']}]
assert status==200 and len(new)==2 and after['vacancy']['revision']==revision+1
results.append(dict(probe='one action creates two activity events on interview entry',status=status,revision_increment=1,new_activity_events=len(new),event_kinds=[e['kind'] for e in new],required_events=1))
Path('/evidence/gpt-targeted-probes.json').write_text(json.dumps({'scope':'Unmodified exported GPT source in an isolated cached verifier runtime with a fresh disposable database; diagnostic evidence, not platform rescoring. Global dependencies are those of pellmoor-tests:2.0.3, not a recreated model npm lock installation.', 'results':results},indent=2)+'\n')
print(json.dumps(results))

import json,re,collections,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
issues=[]
U={u['id']:u for u in d['users']}; J={j['id']:j for j in d['jobs']}; A={a['id']:a for a in d['applications']}
for coll in ('users','jobs','applications'):
    ids=[x['id'] for x in d[coll]]
    if len(ids)!=len(set(ids)): issues.append('dup id '+coll)
emails=[u['email'].lower() for u in d['users']]
if len(emails)!=len(set(emails)): issues.append('dup user email')
assert set(d['candidate_status_labels'])==set(d['stages'])
for j in d['jobs']:
    if U.get(j['recruiter_id'],{}).get('role')!='recruiter': issues.append('job recruiter '+j['id'])
    if U.get(j['manager_id'],{}).get('role')!='hiring_manager': issues.append('job mgr '+j['id'])
    if not (isinstance(j['interview_limit'],int) and 1<=j['interview_limit']<=50): issues.append('limit '+j['id'])
cand={u['email'].lower():u for u in d['users'] if u['role']=='candidate'}
pos=collections.defaultdict(list); seen=set()
for a in d['applications']:
    if a['job_id'] not in J: issues.append('orphan job '+a['id'])
    if a['stage'] not in d['stages']: issues.append('stage '+a['id'])
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$',a['candidate_email']): issues.append('email '+a['id'])
    k=(a['job_id'],a['candidate_email'].lower())
    if k in seen: issues.append('dup job email '+a['id'])
    seen.add(k)
    c=cand.get(a['candidate_email'].lower())
    if c and c['name']!=a['candidate_name']: issues.append('name mismatch '+a['id'])
    pos[(a['job_id'],a['stage'])].append(a['position'])
    if a['stage']=='REJECTED':
        if a.get('rejected_from') in (None,'HIRED','REJECTED') or a['rejected_from'] not in d['stages'] or not a.get('reject_reason','').strip(): issues.append('reject '+a['id'])
    elif 'rejected_from' in a or 'reject_reason' in a: issues.append('stray reject fields '+a['id'])
for k,v in pos.items():
    if sorted(v)!=list(range(1,len(v)+1)): issues.append('positions %s %s'%(k,v))
for j in d['jobs']:
    n=len(pos.get((j['id'],'INTERVIEW'),[]))
    print('interview',j['id'],n,'/',j['interview_limit'])
    if n>j['interview_limit']: issues.append('over limit '+j['id'])
def can_write(uid,app):
    u=U[uid]; job=J[app['job_id']]
    if u['role']=='recruiter': return True
    if u['role']=='hiring_manager': return job['manager_id']==uid
    if u['role']=='candidate': return u['email'].lower()==app['candidate_email'].lower()
    return False
conv=collections.defaultdict(list)
for i,m in enumerate(d['messages']):
    if m['application_id'] not in A: issues.append('orphan msg app %d'%i); continue
    if m['sender_id'] not in U: issues.append('orphan sender %d'%i); continue
    if not can_write(m['sender_id'],A[m['application_id']]): issues.append('unauthorised sender %d'%i)
    if not m['body'].strip(): issues.append('blank %d'%i)
    conv[m['application_id']].append(m)
for k,ms in conv.items():
    ts=[m['created_at'] for m in ms]
    if ts!=sorted(ts) or len(set(ts))!=len(ts): issues.append('order '+k)
    print('conv',k,len(ms),ts[0],ts[-1])
for n in d['notes']:
    if n['application_id'] not in A or n['author_id'] not in U: issues.append('orphan note'); continue
    u=U[n['author_id']]; app=A[n['application_id']]
    if not (u['role']=='recruiter' or (u['role']=='hiring_manager' and J[app['job_id']]['manager_id']==u['id'])): issues.append('note author '+str(n))
rk=set()
for r in d['reads']:
    if r['user_id'] not in U or r['application_id'] not in A: issues.append('orphan read'); continue
    k=(r['user_id'],r['application_id'])
    if k in rk: issues.append('dup read')
    rk.add(k)
    ms=conv[r['application_id']]
    if not (0<=r['read_count']<=len(ms)): issues.append('read range '+str(r))
    app=A[r['application_id']]; u=U[r['user_id']]
    if u['role'] in ('observer',) or not can_write(r['user_id'],app): issues.append('read by non-participant '+str(r))
    unread=sum(1 for m in ms[r['read_count']:] if m['sender_id']!=r['user_id'])
    own_after=[i+1 for i,m in enumerate(ms) if i>=r['read_count'] and m['sender_id']==r['user_id']]
    print('read',k,r['read_count'],'/',len(ms),'unread',unread,'own msgs after marker',own_after)
# unread for each participant per conv (no marker -> 0 read)
for uid,u in U.items():
    tot=0
    for aid,ms in conv.items():
        if u['role']=='observer': continue
        if not can_write(uid,A[aid]): continue
        rc=next((r['read_count'] for r in d['reads'] if r['user_id']==uid and r['application_id']==aid),0)
        tot+=sum(1 for m in ms[rc:] if m['sender_id']!=uid)
    print('total unread',uid,u['name'],tot)
txt=json.dumps(d)
for pat in [r'<\s*script',r'<[a-zA-Z/]',r'javascript:',r'on\w+\s*=',r'(?i)ignore (all|previous)',r'(?i)drop table',r"--",r'(?i)password|secret|token|api[_-]?key|hireops!2026',r'\{\{',r'\$\{',r'\x00']:
    if re.search(pat,txt): print('PATTERN HIT',pat, re.findall('.{0,40}'+pat+'.{0,40}',txt)[:3])
for e in emails+[a['candidate_email'] for a in d['applications']]:
    if not e.split('@')[1].endswith('.example'): issues.append('non-reserved domain '+e)
print('ISSUES',issues)

import copy, json, math, re, tomllib
from datetime import datetime, timedelta
from pathlib import Path

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]/'projects/coursemark-assessment-workspace'
def validate(s):
    def unique(rows,fields):
        keys=[tuple(r[k] for k in fields) for r in rows]
        assert len(keys)==len(set(keys)),f'duplicate {fields}'
    def number(value):
        return type(value) in (int,float) and math.isfinite(value)
    date=lambda value:datetime.fromisoformat(value.replace('Z','+00:00'))
    for collection in ['users','courses','assessments','items','attempts']:
        unique(s[collection],['id'])
    for collection,fields in [('enrollments',['course_id','user_id']),('accommodations',['course_id','student_id']),('answers',['attempt_id','item_id']),('rubric_grades',['attempt_id','criterion_id'])]:
        unique(s.get(collection,[]),fields)
    users={r['id']:r for r in s['users']};courses={r['id']:r for r in s['courses']}
    assessments={r['id']:r for r in s['assessments']};items={r['id']:r for r in s['items']};attempts={r['id']:r for r in s['attempts']}
    enrolled={(r['course_id'],r['user_id']):r['kind'] for r in s['enrollments']}
    for c in courses.values():assert users[c['instructor_id']]['role']=='instructor'
    for e in s['enrollments']:assert e['course_id'] in courses and e['user_id'] in users
    for a in s['accommodations']:
        assert enrolled.get((a['course_id'],a['student_id']))=='student'
        assert all(type(a[k]) is int and a[k]>=0 for k in ['extra_time_minutes','deadline_extension_minutes'])
    for a in assessments.values():
        assert a['course_id'] in courses and a['status'] in ['draft','published']
        assert date(a['opens_at'])<date(a['due_at'])
        assert all(type(a[k]) is int and a[k]>0 for k in ['duration_minutes','max_attempts'])
    criteria={}
    for rubric in s['rubrics']:
        item=items[rubric['item_id']];assert item['kind']=='written'
        assert sum(c['max_points'] for c in rubric['criteria'])==item['points']
        for c in rubric['criteria']:
            assert c['id'] not in criteria and number(c['max_points']) and c['max_points']>0
            criteria[c['id']]={**c,'item_id':item['id']}
    for item in items.values():
        assert item['assessment_id'] in assessments and number(item['points']) and item['points']>0
        if item['kind']=='multiple_choice':
            choices=item['options'];assert len(choices)>=2 and all(type(x) is str and x.strip() for x in choices)
            assert len({x.strip() for x in choices})==len(choices) and item['answer'] in choices
        else:assert item['kind']=='written' and any(c['item_id']==item['id'] for c in criteria.values())
    for a in assessments.values():
        if a['status']=='published':assert any(i['assessment_id']==a['id'] for i in items.values())
    for answer in s['answers']:
        at=attempts[answer['attempt_id']];assert items[answer['item_id']]['assessment_id']==at['assessment_id'] and type(answer['value']) is str
    for grade in s.get('rubric_grades',[]):
        at=attempts[grade['attempt_id']];c=criteria[grade['criterion_id']]
        assert items[c['item_id']]['assessment_id']==at['assessment_id']
        assert at['status']!='in_progress' and number(grade['score']) and 0<=grade['score']<=c['max_points']
        assert grade['graded_by']==courses[assessments[at['assessment_id']]['course_id']]['instructor_id'] or (users[grade['graded_by']]['role']=='teaching_assistant' and grade['graded_by']==at['assigned_grader_id'])
        assert date(at['submitted_at'])<=date(grade['graded_at'])<=date(s['reference_moment']) and type(grade['feedback']) is str
    summaries=[]
    for at in attempts.values():
        a=assessments[at['assessment_id']];assert enrolled.get((a['course_id'],at['student_id']))=='student'
        adjustment=next((r for r in s['accommodations'] if r['course_id']==a['course_id'] and r['student_id']==at['student_id']),{})
        due=date(a['due_at'])+timedelta(minutes=adjustment.get('deadline_extension_minutes',0))
        assert a['status']=='published' and date(a['opens_at'])<=date(at['started_at'])<=due
        assert date(at['started_at'])<=date(s['reference_moment'])
        if at['assigned_grader_id']:
            assert users[at['assigned_grader_id']]['role']=='teaching_assistant' and enrolled.get((a['course_id'],at['assigned_grader_id']))=='staff'
        peers=[r for r in attempts.values() if (r['assessment_id'],r['student_id'])==(a['id'],at['student_id'])]
        assert len(peers)<=a['max_attempts'] and sum(r['status']=='in_progress' for r in peers)<=1
        needed={c['id'] for c in criteria.values() if items[c['item_id']]['assessment_id']==a['id']}
        grades=[g for g in s.get('rubric_grades',[]) if g['attempt_id']==at['id']]
        present={g['criterion_id'] for g in grades}
        answers={r['item_id']:r['value'] for r in s['answers'] if r['attempt_id']==at['id']}
        objective=sum(i['points'] for i in items.values() if i['assessment_id']==a['id'] and i['kind']=='multiple_choice' and answers.get(i['id'])==i['answer'])
        rubric=sum(g['score'] for g in grades)
        if at['status']=='graded':assert present==needed,f"{at['id']} missing rubric grades: {sorted(needed-present)}"
        if at['status']=='submitted':assert present!=needed
        if at['feedback_status']=='released':assert at['status']=='graded'
        if at['status']=='in_progress':assert at['submitted_at'] is None and at['feedback_status']=='hidden' and not grades
        else:assert date(at['started_at'])<=date(at['submitted_at'])<=date(s['reference_moment'])
        if at.get('objective_score') is not None:assert at['objective_score']==objective
        if at.get('rubric_score') is not None:assert at['rubric_score']==rubric
        summaries.append({'attempt':at['id'],'required_criteria':sorted(needed),'recorded_criteria':sorted(present),'derived_objective':objective,'derived_rubric':rubric})
    return summaries

seed=json.loads((ROOT/'tests/coursemark_seed.json').read_text(encoding='utf-8'))
assert (ROOT/'tests/coursemark_seed.json').read_bytes()==(ROOT/'environment/assets/artifacts/coursemark_seed.json').read_bytes()
summaries=validate(seed);negative=[]
def rejected(name,bad):
    try:validate(bad)
    except (AssertionError,KeyError) as error:negative.append({'name':name,'rejected':True,'reason':str(error)})
    else:raise AssertionError('Invalid seed accepted: '+name)
rejected('previous delivered missing-grade seed',json.loads((OUT/'source-before-repair/tests/coursemark_seed.json').read_text(encoding='utf-8')))
bad=copy.deepcopy(seed);bad['rubric_grades'].pop();rejected('incomplete graded rubric',bad)
bad=copy.deepcopy(seed);bad['rubric_grades'].append(bad['rubric_grades'][0]);rejected('duplicate rubric grade',bad)
bad=copy.deepcopy(seed);bad['rubric_grades'][0]['criterion_id']='RC-1';rejected('grade from another assessment',bad)
bad=copy.deepcopy(seed);bad['rubric_grades'][0]['graded_by']='user_4';rejected('student as grader',bad)
bad=copy.deepcopy(seed);bad['attempts'][2]['rubric_score']=2;rejected('incorrect rubric aggregate',bad)
bad=copy.deepcopy(seed);bad['attempts'][2]['objective_score']=4;rejected('incorrect objective aggregate',bad)
bad=copy.deepcopy(seed);bad['answers'][0]['item_id']='I-01';rejected('answer from another assessment',bad)
bad=copy.deepcopy(seed);bad['rubric_grades'][0]['score']=True;rejected('Boolean rubric grade',bad)
judges={d:tomllib.loads((ROOT/f'tests/{d}/judge.toml').read_text(encoding='utf-8')) for d in ['render','constraints','functional','polish','visual']}
byid={c['id']:c for j in judges.values() for c in j['criterion']}
status_audit=[]
for cid in ['two_tab_revisions_receipts_and_duplicate_guard','release_plan_stale_atomic_commit_and_replay']:
    text=byid[cid]['description'];assert '4xx' in text and '409 or 412 are valid' in text
    status_audit.append({'criterion':cid,'accepted_stale_status':'4xx; 409 and 412 explicitly valid','contract':'coordination.md and outcomes.md'})
for cid in ['receipt_route_and_input_binding','worksheet_concurrent_grading_and_receipts']:
    assert '409' in byid[cid]['description'];status_audit.append({'criterion':cid,'exact_status':409,'scope':'operation identity mismatch','contract':'coordination.md'})
assert 'HTTP 200' in byid['public_deployment_health_contract']['description']
status_audit.append({'criterion':'public_deployment_health_contract','exact_status':200,'contract':'overview.md'})
report={'kind':'Independent seed invariants and explicit HTTP contract audit; not platform QC','passed':True,'seed_summaries':summaries,'negative_seed_cases':negative,'status_contract_audit':status_audit}
(OUT/'seed-contract-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('PASS full seed relationships, grade completeness, derived scores, 9 invalid-seed cases and HTTP contract audit')

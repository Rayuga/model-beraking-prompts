import csv
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/coursemark-assessment-workspace'
RUNS=ROOT/'run-outputs/coursemark-assessment-workspace'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
link=lambda p:os.path.relpath(p,OUT).replace('\\','/')
rows=[]
criteria_rows=[]
details={}
trials={}
for p in sorted(RUNS.glob('*/*/result.json')):
    trial=read(p)
    agent=trial['agent_info']
    model=(agent.get('model_info') or {}).get('name') or agent['name']
    trials[model]=p.parent
    reward=read(p.parent/'verifier/reward.json')
    row={'model':model,'run':p.parent.parent.name,'trial':p.parent.name,'task_checksum':trial['task_checksum'],'scores':reward,
         'exception_type':(trial.get('exception_info')or{}).get('exception_type'),
         'agent_exit_137':'exit 137' in (trial.get('exception_info')or{}).get('exception_message',''),
         'verifier_minutes':round((datetime.fromisoformat(trial['verifier']['finished_at'])-datetime.fromisoformat(trial['verifier']['started_at'])).total_seconds()/60,2),
         'evidence':link(p.parent/'verifier/reward.json')}
    provenance=read(p.parent/'verifier/prompt-provenance.json')
    row['provenance_matches_source']=all(v['prompt_sha256']==sha(TASK/f'tests/{d}/prompt.md') and v['judge_sha256']==sha(TASK/f'tests/{d}/judge.toml') for d,v in provenance['judges'].items()) and provenance['runner_sha256']==sha(TASK/'tests/test.sh') and provenance['reward_config_sha256']==sha(TASK/'tests/reward.toml')
    assert row['provenance_matches_source']
    if reward['graded']:
        expected=0 if reward['render']<=0 or reward['constraints']<=0 else round(.6*reward['functional']+.2*reward['polish']+.2*reward['visual'],4)
        assert expected==reward['reward']
        detail=read(p.parent/'verifier/reward-details.json')
        details[model]=detail
        row['counts']={}
        for dim,data in detail.items():
            cs=data['criteria']
            weighted=round(sum(c['value']*c['weight'] for c in cs)/sum(c['weight'] for c in cs),4)
            assert weighted==reward[dim],(model,dim,weighted)
            row['counts'][dim]={'full_credit':sum(c['value']==1 for c in cs),'less_than_full':sum(c['value']<1 for c in cs),'total':len(cs)}
            for c in cs:criteria_rows.append({'model':model,'dimension':dim,**{k:c[k]for k in ['id','value','raw','weight','reasoning']}})
    rows.append(row)
assert len(rows)==5 and len(criteria_rows)==220
assert len({r['task_checksum']for r in rows})==1
oracle_app=trials['oracle']/'artifacts/app'
oracle_matches={name:sha(TASK/'solution'/name)==sha(oracle_app/name)for name in ['server.js','public/app.js','public/index.html','public/styles.css','package.json','APP_MANIFEST.md']}
assert all(oracle_matches.values())
summary={'kind':'Actual imported platform grades; supplemental local probes kept separate','runs':rows,'oracle_deployed_files_match_delivered_source':oracle_matches,'task_source_modified':False,'new_zip_created':False}
(OUT/'run-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
with (OUT/'criterion-results.csv').open('w',newline='',encoding='utf-8-sig')as f:
    writer=csv.DictWriter(f,fieldnames=list(criteria_rows[0]));writer.writeheader();writer.writerows(criteria_rows)
order=['oracle','gpt-5.4-mini','gemini-3.7-flash','claude-haiku-4-5','nop']
labels={'oracle':'Oracle','gpt-5.4-mini':'GPT-5.4-mini','gemini-3.7-flash':'Gemini 3.7 Flash','claude-haiku-4-5':'Claude Haiku 4.5','nop':'Nop'}
table=['| Run | Final reward | Functional | Polish | Visual | Status |','|---|---:|---:|---:|---:|---|']
for model in order:
    r=next(r for r in rows if r['model']==model);s=r['scores']
    status='No app; ungraded fallback' if model=='nop' else 'Agent exit 137; partial app graded' if r['agent_exit_137'] else 'Graded'
    table.append(f"| [{labels[model]}]({r['evidence']}) | **{s['reward']:.4f}** | {s['functional']:.4f} | {s['polish']:.4f} | {s['visual']:.4f} | {status} |")
report='''Coursemark scored-run review — 14 September 2026

The verifier repair worked. Four submitted apps now have graded = 1, no_op = 0, populated per-criterion results and recomputable scores. Oracle is 0.9583, with every Functional and Polish criterion passing. It falls short of the requested 1.0 solely on Visual. GPT is 0.7697 and Gemini 0.7160, so the requested upper bound of 0.7 is not yet met. Haiku's 0.0707 is confounded by its agent being killed with exit 137; it is not a clean completed-model comparison.

'''+ '\n'.join(table)+'''

Render and Constraints are 1.0 for all four graded apps. Nop contains no submitted app and remains graded = 0. These are actual platform results, unlike the previous fallback-zero exports or the earlier local API probes.

All five trials use platform task checksum `6d4f99ea2b0cbc3d837f13951d0572ff7a8c41e2ddd2889195ca3174345bc465`. Every imported prompt, judge, runner and reward-configuration hash matches the delivered source. Oracle's deployed server, browser files, package and app manifest also match. The platform task checksum and ZIP SHA-256 use different scopes and must not be compared as interchangeable hashes.

Use `verifier/reward.json` and the outer trial result for the final reward. The short `rewardkit.log` contains intermediate aggregates that count the gate dimensions: Oracle 0.9861, GPT 0.9232, Gemini 0.9053 and Haiku 0.6902. The task runner correctly applies the final 60/20/20 formula after those logs. All final rewards and all five dimension aggregates were recomputed successfully. The [machine-readable summary](run-summary.json) and [complete 220-row criterion spreadsheet](criterion-results.csv) preserve the evidence.

GPT passes 26/31 Functional criteria, earning 35.75 of 48.75 weight. Five failures lose 13.0 weight:

| Failed Functional criterion | Weight | What actually failed |
|---|---:|---|
| question_validation_and_publish_lifecycle | 1 | Empty drafts leave Publish enabled. The backend rejects the click, but the brief requires the control to be unavailable. |
| start_attempt_and_single_active_guard | 1 | A fresh operation while an attempt is already active returns 200 with the existing attempt instead of refusing the new start. No duplicate record is required for this failure. |
| server_rubric_numeric_validation | 4 | Empty-string scores are coerced to zero and accepted; other tested malformed values are rejected. |
| unreleased_write_and_audit_privacy | 4 | Privacy and exact submit replay pass. The failure is objective-only completion: the attempt remains submitted and release returns 409 not_ready. It is not a score leak. |
| write_metadata_and_owned_fields | 3 | Revision and operation validation pass, but create requests containing claimed actor/status/total/timestamps are accepted with the claims ignored. This violates explicit reject-on-owned-fields behavior; it does not demonstrate privilege escalation. |

Four backend defects were independently reproduced on the exported GPT app in a fresh disposable database: duplicate-active start returned 200; empty score returned 200 with revision +1; a draft containing server-owned claims returned 201 with revision +1; and an objective-only submission could not be released (409 not_ready). Positive rubric saves worked; missing/null/Boolean/nonnumeric/negative/over-maximum values were rejected without revision changes. See [GPT supplementary observations](gpt-reproduction.json). The remaining enabled-Publish finding is recorded by the platform judge; platform browser traces and screenshots are not included in these exports.

GPT's passed behavior is substantial: real sessions and account-wide revocation; seeded schedules and accommodations; student/TA filtering and answer-key privacy; exact expiry; answer persistence; normal mixed-assessment grading and release; audit ordering; stale-tab rejection/fresh retry; restart persistence; fixed reference time after writes; actor-scoped receipts; route/input binding; reordered-JSON replay; and authoring validation. Four of the six newly added hardening criteria now pass, contributing 14 of their 21 weight.

This explains why the earlier conditional 0.692 ceiling did not apply. That calculation assumed all seven previously demonstrated weaknesses persisted. The fresh GPT solution fixed several of them. It was never a measured or guaranteed score cap for a newly generated solution. For this run the actual calculation is `0.6 × 0.7333 + 0.2 × 0.8571 + 0.2 × 0.7917 = 0.76974`, rounded to 0.7697.

GPT also fails two Polish criteria: closing a dialog returns focus to the document body, and student views omit explicit accommodation cues. Functional timing correctness and visible accommodation explanation are different observations. Its Visual score is identical to Oracle's, so the golden currently has no Visual advantage over GPT.

Oracle passes 31/31 Functional, 14/14 Polish, 2/2 Render and 2/2 Constraints criteria. All six new hardening criteria pass on the platform. There is no recorded functional golden defect to repair from this run. The entire 0.0417 shortfall comes from these Visual ratings:

| Visual axis | Raw rating | Normalized value | Judge's reason for lost credit |
|---|---:|---:|---|
| Typography | 4 | 0.75 | Long attempt IDs, audit metadata and compact mobile navigation are slightly small/dense. |
| Color and contrast | 4 | 0.75 | Some muted metadata and disabled controls have softer contrast. |
| Spacing and layout | 4 | 0.75 | Persistent purple main outline and dense mobile header. |
| Hierarchy and scanability | 5 | 1.00 | Full credit. |
| Overall craft | 4 | 0.75 | Minor responsive details prevent top-tier finish. |
| Responsive consistency | 4 | 0.75 | Mobile navigation and some dialog content are compact/scroll-dependent. |

The framework records raw 4 as normalized 0.75 and raw 5 as 1.0; use the recorded values, not 4/5 = 0.8. The mean is 0.7917. With the other dimensions fixed at 1, overall reward is `0.8 + 0.2 × 0.7917 = 0.95834`. Oracle exceeds 0.95 but does not meet the user's explicit 1.0 target.

The focused golden improvement is visual, preserving all working behavior: restrict the large main outline to keyboard focus instead of every mouse navigation; increase tiny mobile navigation and secondary text; simplify the dense mobile identity/reference header; improve muted-text contrast; and wrap long IDs and dialog content deliberately. Current CSS corroborates the observations: `.content:focus` creates the persistent outline, mobile tabs use `clamp(0.56rem, 2.45vw, 0.72rem)`, mobile secondary text uses 0.6rem, and audit times use 0.68rem with light gray. At 375px the tab text is about 9.19px. Preserve keyboard focus visibility, all five reachable tabs, session/revision/time context and natural dialog scrolling. Scrolling alone is allowed by the brief and must not be made a failure. Recheck actual screenshots at both required sizes and rerun Oracle; do not lower Visual anchors or claim future 1.0 without a new run.

Gemini passes 24/31 Functional criteria and 13/14 Polish criteria. Its seven Functional deductions are:

- One visible answer save generates two accepted requests/revision increments.
- The UI requires both rubric scores together, preventing the required independent criterion-save workflow.
- Empty-draft Publish stays enabled.
- The judge did not successfully finish the fresh-current-revision retry in the two-tab workflow; a rejected stale write alone does not establish whether retry is broken.
- The judge did not complete the numeric-validation baseline/matrix/replacement journey before the final restart.
- The objective-only grading/release UI does not expose a working release path, although score privacy passes.
- Receipt identities are global: Nora's legitimate write using Ada's second operation ID returns 409 “Operation identifier belongs to another user”, violating independent actor namespaces.

The numeric-validation deduction is an evidence-quality issue. A supplementary API reproduction against exactly this exported Gemini source accepted the baseline and replacement saves, rejected all seven malformed score cases with 400, and preserved revision on each rejection. See [Gemini supplementary observations](gemini-reproduction.json). This supports the backend, but it does not replace the required visible UI journey or authorize changing the recorded verdict. The two-tab retry likewise needs a complete reproduction before classifying its zero as a confirmed application defect. No detailed judge trajectory accompanies these exports, and there is no recorded verifier timeout; do not invent a timeout explanation for an unfinished subtest.

If only the weight-4 numeric criterion were legitimately awarded after a completed rerun, Gemini would gain roughly 0.0492 overall, moving from 0.7160 to about 0.7652. That is conditional arithmetic, not a corrected official score. Therefore the present Gemini score may understate capability; it is not a reliable basis for declaring the task difficult enough.

Gemini's Polish failure is missing visible keyboard focus on sign-in inputs. Visual scores are typography 4, color 5, spacing 3, hierarchy 4, craft 4 and responsive consistency 2. Mobile Attempts/Gradebook/Audit crop or hide columns, and horizontal navigation clips items. These are more substantial responsive weaknesses than Oracle's or GPT's minor deductions.

Haiku's agent exits 137 after approximately eight minutes, reported as UnknownApiError. The export does not establish whether this was OOM, an external kill or another infrastructure cause. Its partial app still reaches grading, passing only five Functional criteria: seeded sign-in/identity, bearer transport, instructor seeded schedule, account-wide token revocation and reauthentication isolation. It lacks core authoring, answer editing, grading/release, timing and receipt workflows. The judge reports exposed answer keys and a missing TA grading queue.

Haiku's Polish zero is a global-gate failure caused by an unresolved Syncing state after authenticated reload. Its Visual zero is a different shared-gate failure: old tokens still authorized reads after visible sign-out, with blank overlays and unresolved sync also observed. Earlier dimensions reported revocation success, so this inconsistency needs trace-level follow-up; it cannot be summarized as twenty independently measured UI/aesthetic failures. Rerun a completed Haiku generation before treating its 0.0707 as a clean difficulty result.

The next revision should separate three jobs. First improve the golden's evidenced visual defects, leaving its passing functional implementation intact. Second make judge execution complete and reviewable: preserve valid rubric baselines, execute the full invalid-value matrix, complete stale-tab refresh/retry, and retain actual request/response evidence before the final restart. Preserve score records; do not award unexecuted criteria automatically. Third add substantive coverage of existing course-integrity requirements where it is still thin: grading from concurrent staff tabs, replay across grade/release state transitions, exactly-once state/revision/audit behavior, and completion/release across objective-only, written-only and mixed assessments under manual submit and expiry. Expand only explicitly documented product requirements and update the golden/tests together.

Do not raise a few failure weights or duplicate the same defect across criteria merely to force this one GPT result below 0.7. The latest model learned most prior hardening requirements, and one sample per model cannot establish a robust range. Freeze a revised package and rerun Oracle plus multiple model samples. The acceptance targets remain Oracle = 1.0 and the requested model range, with completed grading and independent evidence for every criterion.

This review creates analysis files only. It does not modify the task, change stored scores, produce a new ZIP or claim the current package meets both targets. Supplementary probes used the cached `coursemark-tests:1.0.17` runtime and fresh databases with the supplied seed; they did not mutate the exported apps. The full platform verdicts follow so every pass and deduction can be audited.

'''
for model in order[:-1]:
    report+=f"\n**{labels[model]}: complete recorded verdicts.** [Original reward details]({link(trials[model]/'verifier/reward-details.json')}).\n\n"
    for dim in ['render','constraints','functional','polish','visual']:
        report+=f"\n{dim.capitalize()} ({details[model][dim]['score']:.4f}):\n\n| Criterion | Raw | Value | Weight | Recorded reason |\n|---|---|---:|---:|---|\n"
        for c in details[model][dim]['criteria']:
            reason=c['reasoning'].replace('|','\\|').replace('\n',' ')
            report+=f"| {c['id']} | {c['raw']} | {c['value']:.2f} | {c['weight']:g} | {reason} |\n"
(OUT/'ANALYSIS.md').write_text(report,encoding='utf-8')
print(json.dumps({'report':str(OUT/'ANALYSIS.md'),'trials':len(rows),'criterion_rows':len(criteria_rows),'all_provenance_matches':all(r['provenance_matches_source']for r in rows),'scores':{r['model']:r['scores']['reward']for r in rows}},indent=2))

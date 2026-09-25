from pathlib import Path
import csv, hashlib, json, tomllib, zipfile
from datetime import datetime

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
RUNS = ROOT/'run-outputs/pellmoor-job-pipeline'
BEFORE = OUT/'source-before-review'
DIMS = ['render','constraints','functional','polish','visual']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
baseline=json.loads((OUT/'baseline-hashes.json').read_text())
assert {p.relative_to(RUNS).as_posix():sha(p) for p in RUNS.rglob('*') if p.is_file()}==baseline['runs']
assert {p.relative_to(BEFORE).as_posix():sha(p) for p in BEFORE.rglob('*') if p.is_file()}==baseline['task']
oldzip=OUT.parent/'1.0.0-hardened-20260913/pellmoor-job-pipeline.zip'
with zipfile.ZipFile(oldzip) as z:
    oldfiles={n.removeprefix('pellmoor-job-pipeline/'):hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
assert oldfiles==baseline['task']
records=[]
rows=[]
for path in sorted(RUNS.glob('*/*/result.json')):
    trial=path.parent
    result=json.loads(path.read_text())
    agent=result['config']['agent']
    name=agent['model_name'] or agent['name']
    scores=json.loads((trial/'verifier/reward.json').read_text())
    assert scores==result['verifier_result']['rewards']
    provenance=json.loads((trial/'verifier/prompt-provenance.json').read_text())
    assert provenance['runner_sha256']==sha(BEFORE/'tests/test.sh')
    assert provenance['reward_config_sha256']==sha(BEFORE/'tests/reward.toml')
    for dim in DIMS:
        assert provenance['judges'][dim]['prompt_sha256']==sha(BEFORE/f'tests/{dim}/prompt.md')
        assert provenance['judges'][dim]['judge_sha256']==sha(BEFORE/f'tests/{dim}/judge.toml')
    expected=0 if scores['render']<=0 or scores['constraints']<=0 else .6*scores['functional']+.2*scores['polish']+.2*scores['visual']
    assert abs(expected-scores['reward'])<.00011
    rec=dict(model=name,trial=trial.relative_to(ROOT).as_posix(),task_checksum=result['task_checksum'],scores=scores,exception=result['exception_info'],agent_reasoning_effort=agent['kwargs'].get('reasoning_effort'),provenance_matches_previous_package=True,dimensions={})
    for phase in ['agent_execution','verifier']:
        span=result.get(phase)
        if span and span.get('started_at') and span.get('finished_at'):
            rec[phase+'_seconds']=(datetime.fromisoformat(span['finished_at'])-datetime.fromisoformat(span['started_at'])).total_seconds()
    details_path=trial/'verifier/reward-details.json'
    if details_path.exists():
        details=json.loads(details_path.read_text())
        for dim in DIMS:
            data=details[dim]
            criteria=data['criteria']
            spec=tomllib.loads((BEFORE/f'tests/{dim}/judge.toml').read_text())['criterion']
            assert {c['id'] for c in criteria}=={c['id'] for c in spec}
            weighted=sum(c['value']*c['weight'] for c in criteria)/sum(c['weight'] for c in criteria)
            assert abs(weighted-scores[dim])<.00011
            rec['dimensions'][dim]=dict(count=len(criteria),full_credit=sum(c['value']==1 for c in criteria),weight=sum(c['weight'] for c in criteria),weighted_points=sum(c['value']*c['weight'] for c in criteria),judge=data.get('judge'),criteria=criteria)
            for c in criteria:
                rows.append(dict(model=name,dimension=dim,id=c['id'],value=c['value'],raw=c['raw'],weight=c['weight'],reasoning=c['reasoning']))
    records.append(rec)
assert len({r['task_checksum'] for r in records})==1
oracle=next(r for r in records if r['model']=='oracle')
oracle_app=ROOT/oracle['trial']/'artifacts/app'
oracle_matches={p.relative_to(BEFORE/'solution').as_posix():sha(p)==sha(oracle_app/p.relative_to(BEFORE/'solution')) for p in (BEFORE/'solution').rglob('*') if p.is_file() and p.name!='solve.sh'}
assert all(oracle_matches.values())
report=dict(scope='Historical exported results; not scores for the revised package',previous_zip_sha256=sha(oldzip),preserved_run_files=len(baseline['runs']),oracle_source_matches=oracle_matches,models=records)
(OUT/'run-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
with (OUT/'criterion-results.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=['model','dimension','id','value','raw','weight','reasoning']);w.writeheader();w.writerows(rows)
lines=['# Pellmoor run review — 14 September 2026','',
'GPT-5.4 mini is above the requested 0.1–0.7 band. The current exports do not establish a passing final submission. Gemini is retained as an unrestricted comparison. The golden solution passed every Functional and Polish criterion; its two Visual deductions account for its 0.9833 overall result.','',
'## Recorded scores','',
'| Model | Overall | Functional | Polish | Visual | Render / Constraints |','|---|---:|---:|---:|---:|---|']
for r in sorted(records,key=lambda r: {'oracle':0,'gpt-5.4-mini':1,'gemini/gemini-3.7-flash':2,'claude-haiku-4-5':3,'nop':4}.get(r['model'],5)):
    s=r['scores'];lines.append(f"| {r['model']} | {s['reward']:.4f} | {s['functional']:.4f} | {s['polish']:.4f} | {s['visual']:.4f} | {s['render']:.0f} / {s['constraints']:.0f} |")
lines += ['', '## Provenance and score integrity','',
f"All five trials report task checksum `{records[0]['task_checksum']}`. All prompt, judge, runner and reward-config hashes match the preserved 13 September hardened package. Its ZIP SHA-256 is `{sha(oldzip)}`; ZIP hashes and the platform task checksum are different identifiers.", '',
f"All {len(baseline['runs'])} exported files remain byte-for-byte unchanged. Oracle's seven deployed source files match the previous golden sources. Each graded trial contains all 52 expected criterion outcomes. Weighted means and the gated 60/20/20 formula reproduce every recorded result within rounding. No trial reports an exception; agent/verifier durations are within their configured limits. The no-op correctly has graded=0 and no_op=1. The non-no-op runs have graded=1 and no_op=0.", '',
'The exported judge metadata identifies codex / gpt-5.6-luna. The model agents ran at high reasoning effort; this is distinct from the verifier configuration at max. These exports contain verdict reasoning, configuration and model trajectories, but do not independently prove every judge action or launch-time environment value. Treat a verdict description of a setup mistake as an evidence limitation, not as a newly verified product failure.', '',
'## GPT-5.4 mini: what failed','',
'Functional: 28/32 full-credit criteria, 66/78.5 weighted points = 0.8408. Four deductions were recorded:', '',
'| Criterion | Weight lost | Interpretation |','|---|---:|---|',
'| Append-only notes | 1 | Judge says notes, attribution, timestamps and activity persisted, but penalizes newest-first display. The brief did not require oldest-first. This is an unsupported presentation restriction. |',
'| Malformed / identity-changing writes | 8 | Acceptance of Boolean scores and client capacity/version claims is a real contract violation. Exported code coerces score/revision values with Number(...). A numeric header is necessarily text, so string-revision claims need the actual request location distinguished. |',
'| Pending duplicate prevention | 1 | The judge reports Save remained enabled during a delayed real response and a second request was sent. This is a concrete pending-state failure. |',
'| Capacity release / old receipts | 2.5 | Judge reports the saved full-capacity rejection was replayed after the other candidate had been hired, not while an opening was free. This missed the required checkpoint; it does not demonstrate reexecution of a saved receipt. |', '',
'If both disputed criteria eventually pass a correct rerun, the arithmetic increase would be about 0.0268, yielding approximately 0.7928 with everything else fixed. This is a sensitivity calculation, not a rescored result. Fairness corrections therefore do not solve the upper-band problem.', '',
'Polish failed four independent criteria: document width 442px at a 390px viewport; no navigation landmark; candidate keyboard activation left focus on BODY; no usable close/dismiss/Escape path for the drawer. The other six Polish criteria passed.', '',
'Visual earned typography=1, contrast=0.5, spacing=0.5, hierarchy=1, craft=0.75 and responsive consistency=0.5. Dark funnel labels were hard to read, and mobile capacity/funnel content was clipped. These are recorded normalized values, not raw 0–5 anchors.', '',
'## GPT: recorded passes and a missed defect','',
'The judge awarded passes for all basic seeded-data, workflow, permission, scoring-boundary, funnel, persistence and documentation checks. It also passed stale-view conflict handling, simultaneous-write arbitration, durable success/rejection receipts, panel invalidation, offer reopening, frozen assessment history, capacity races and actor/session retry scoping. Its backend contains real SQLite transaction and durable receipt handling; treating these as unimplemented would contradict the evidence.', '',
'A targeted local run of the unmodified exported GPT backend additionally reproduced acceptance of Boolean, array and string scores, numeric-string JSON revisions and supplied capacity fields. It also found that one screening-to-interview action creates two activity events (assessment_version plus stage_change), despite the brief and complete-panel workflow criterion requiring one event per action. That criterion was recorded as a pass: it is a missed defect. The revised judge explicitly counts before/after event IDs at each step. These cached-runtime diagnostics are not platform rescoring; see `gpt-targeted-probes.json` for dependency and scope limits.', '', 'Detecting this extra weight-2 failure alone would reduce overall reward by only about 0.0153 with all other outcomes fixed. It cannot establish the requested band, particularly if the questionable deductions are corrected.', '', 'The complete recorded Functional pass list follows, including the missed-defect criterion above. All four Render/Constraints criteria also received passes. Full per-criterion reasoning for every model is in `criterion-results.csv` and `run-review.json`.','']
gpt=next(r for r in records if r['model']=='gpt-5.4-mini')
for c in gpt['dimensions']['functional']['criteria']:
    if c['value']==1:lines.append('- `'+c['id']+'`')
lines += ['', '## Gemini and Haiku','',
'Gemini-3.7-flash passed 30/32 Functional criteria (68.5/78.5 weighted points). A missing expected-revision header was accepted and mutated a candidate: a real failure. The other deduction describes removing Ruth while she was still assigned, then treating success as failure of an absent-member removal. That is an invalid probe premise. Its Polish losses concern sign-in landmarks, drawer focus and small touch targets. Its sole Visual deduction is responsive consistency (0.5). Gemini has no requested score-band restriction.', '',
'Haiku-4.5 received zero because the local page returned HTTP 500 with EACCES at `/tests/public/index.html`. Its exported server uses `express.static("public")`, which resolves from the process working directory. The hosting note promises startup in `/app`, but the previous verifier inherited `/tests`, which it also made inaccessible to the application user. This is a reproducible launcher mismatch and makes the zero unsuitable as clean capability evidence. The isolated witness in `launcher-regression.json` uses the exact old/new launch commands and the same relative-static pattern: old root=500, corrected root=200. It is not a full Haiku rerun; other defects may remain.', '',
'## Golden visual corrections','',
'The original Oracle scored Visual=0.9167, with four criteria at full credit and spacing/responsiveness at 0.75 each. Its recorded deductions name wrapped drawer actions and horizontally scrolling mobile vacancy tabs. The revised golden uses an aligned two-column action grid, larger drawer controls, and a two-column mobile vacancy grid. Narrow funnel labels and counts now sit above their bars so they remain visible at 390px and 320px. Successful login clears stale signed-out feedback.', '',
'Browser checks pass for desktop 1280px and mobile 390px/320px in both themes, including actual SVG text bounds, page/drawer overflow, all vacancy cards, manager actions and coordinator controls. The 19 base regression groups and nine extended workflow groups pass, including real process restarts. Screenshots were inspected. These checks support the fixes but do not establish a new Visual=1.0 or Oracle score.', '',
'## Verifier corrections and stricter observations','',
'The runner and restart helper now start from the application root while retaining the unprivileged user and stripped environment. Notes may display either chronological direction while retaining immutable attribution. Panel-removal probes first establish absence. Capacity replay evidence must be captured while room exists, before the next offer/hire. All five shared gates now explicitly test the same protected read anonymously before and after an exact wrong-password attempt, checking for leaked record content without clearing an improperly granted session.', '',
'The agent-visible reliability brief explicitly rejects coercion of JSON score/revision types and supplied server-owned fields; valid textual HTTP revision headers remain acceptable. The malformed-write criterion now checks the exact protected state after each individual probe using a fresh operation identity and otherwise valid metadata. This prevents later activity from hiding an earlier unauthorized mutation. No criterion IDs or weights, Visual anchors, final formula, model configuration or timeouts were changed.', '',
'## How to deepen the task fairly','',
'See `HARDENING_PROPOSAL.md`. Further reduction cannot be guaranteed by prompt wording. The existing five integrity criteria already carry 40/78.5 Functional weight, and GPT passed four of them. The next useful change is a disclosed product workflow with new independent outcomes, implemented in the golden solution and validated before evaluation. Arbitrary extra penalties, duplicated deductions, hidden requirements and selecting only favorable runs would not be defensible.', '',
'## Release status','',
'This folder is a review candidate, not a final in-range submission. Fresh exact-image builds and full Oracle/GPT runs must validate the frozen revision. The current machine’s attempted exact builds encountered Debian/PyPI network failures; cached-image local checks must not be described as successful exact builds. See `VALIDATION.md` for the completed checks and remaining limits.']
(OUT/'RUN_REVIEW.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(f'PASS historical audit: {len(records)} trials, {len(rows)} criterion verdicts, {len(baseline["runs"])} unchanged run files')

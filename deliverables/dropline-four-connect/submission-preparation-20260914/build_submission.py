from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tomllib
import zipfile
from report_document import Report, TEMPLATES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SLUG = 'dropline-four-connect'
TASK = ROOT/'projects'/SLUG
RUNS = ROOT/'run-outputs'/SLUG
OUT = HERE.parent/'final-submission-20260914'
SOURCE_ZIP = HERE.parent/'1.0.0-deduplicated-r6-20260914'/f'{SLUG}.zip'
TASK_SHA = '577451c9d67ef834db1c8366af284b323233ad4f7abc20e396c23c562dd1d63a'
CHECKSUM = 'eb8032690866af12d7cd5f5db6611f63b9b3cad39b5b15f11cb0213a6d014e21'
DIMS = ['render','constraints','functional','polish','visual']
JOBS = {
 'oracle': ('run-e774bb6c-482c-4c2f-9556-4e7b711b28eb','Zs5Xeyz','Oracle'),
 'gpt-5.4-mini-high': ('run-419a24fc-0ad9-49f8-9e5e-9f2bb074af37','ix4VYyy','GPT-5.4 mini (high)'),
 'gemini-3.7-flash': ('run-529333a1-1889-49d5-90fe-edc0b7a5fc4b','JW8NdRB','Gemini 3.7 Flash'),
 'claude-haiku-4.5': ('run-30cde599-faf1-4876-afd2-2d67c76512ab','GXVYjdh','Claude Haiku 4.5'),
}
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
fmt = lambda x: f'{x:.4f}'

# Reuse only the established read-only hashing and credential-safe archive builder.
spec = importlib.util.spec_from_file_location('prior_packager',ROOT/'deliverables/brickfall-breaker-arcade/submission-preparation-20260912/build_submission.py')
prior = importlib.util.module_from_spec(spec)
sys.dont_write_bytecode = True
spec.loader.exec_module(prior)
prior.SLUG, prior.RUNS, prior.OUT, prior.JOBS = SLUG, RUNS, OUT, JOBS
hashes = prior.tree_hashes

def evidence():
    records={}
    for key,(job,suffix,label) in JOBS.items():
        trial=RUNS/job/f'{SLUG}__{suffix}'
        result=read(trial/'result.json'); rewards=read(trial/'verifier/reward.json')
        details=read(trial/'verifier/reward-details.json'); prov=read(trial/'verifier/prompt-provenance.json')
        assert result['task_checksum']==CHECKSUM
        assert result['exception_info'] is None
        assert rewards==result['verifier_result']['rewards']
        assert rewards['graded']==1 and rewards['no_op']==0
        for dim in DIMS:
            cfg=tomllib.loads((TASK/f'tests/{dim}/judge.toml').read_text())
            cs=details[dim]['criteria']
            assert len(cs)==len(cfg['criterion'])
            for a,b in zip(cs,cfg['criterion']):
                assert (a['id'],a['weight'],a['description'])==(b['id'],b['weight'],b['description'])
            score=min(c['value'] for c in cs) if cfg['scoring']['aggregation']=='all_pass' else round(sum(c['value']*c['weight'] for c in cs)/sum(c['weight'] for c in cs),4)
            assert abs(score-rewards[dim])<.00011
            for fn,k in [('prompt.md','prompt_sha256'),('judge.toml','judge_sha256')]:
                assert sha((TASK/f'tests/{dim}/{fn}').read_bytes())==prov['judges'][dim][k]
        for fn,k in [('tests/test.sh','runner_sha256'),('tests/reward.toml','reward_config_sha256')]:
            assert sha((TASK/fn).read_bytes())==prov[k]
        score=0 if rewards['render']<=0 or rewards['constraints']<=0 else round(.6*rewards['functional']+.2*rewards['polish']+.2*rewards['visual'],4)
        assert abs(score-rewards['reward'])<.00011
        records[key]=dict(path=trial,job=job,label=label,result=result,rewards=rewards,details=details)
    nop=read(RUNS/JOBS['oracle'][0]/f'{SLUG}__zndFqyn/result.json')
    assert nop['task_checksum']==CHECKSUM and nop['verifier_result']['rewards']['reward']==0
    assert nop['verifier_result']['rewards']['no_op']==1
    assert records['oracle']['rewards']['functional']==1
    assert all(c['value']==1 for c in records['oracle']['details']['functional']['criteria'])
    for p in (TASK/'solution/app').rglob('*'):
        if p.is_file(): assert p.read_bytes()==(records['oracle']['path']/'artifacts/app'/p.relative_to(TASK/'solution/app')).read_bytes()
    return records,nop

def intro(report,subtitle):
    report.paragraph(report.title,'Title')
    report.paragraph(subtitle,color='52657A')
    report.paragraph('Harbor task: turing/dropline-four-connect | version 1.0.0 | prepared 14 September 2026',size=18)
    report.paragraph('Recorded platform outcomes on the frozen r6 package. No score adjustment or fresh paid run was performed during delivery preparation. Interpretation limits are stated below.',size=18)

def score_table(report,records):
    rows=[]
    for r in records.values():
        s=r['rewards'];count=sum(c['value']==1 for c in r['details']['functional']['criteria'])
        rows.append([r['label'],fmt(s['reward']),fmt(s['functional']),fmt(s['polish']),fmt(s['visual']),f'{count}/42; '+('both gates pass' if s['constraints'] else 'Constraints = 0')])
    rows.append(['No-op','0.0000','0.0000','0.0000','0.0000','graded=0; no_op=1'])
    report.table(['Run','Overall','Functional','Polish','Visual','Recorded status'],rows,[2350,1100,1200,1100,1100,3590],size=17)
    report.paragraph('Render is 1.0 for all four built applications. Constraints is 1.0 for Oracle, GPT-mini and Gemini, and 0.0 for Haiku. No-op zeros are control outputs, not 58 independently observed failures.')

FEATURES=[
 ('Identity and durable games','Two seeded accounts; protected bearer sessions and account-wide logout; exact boards, scores, histories, revisions and private archives.'),
 ('Connect Four and replay','Gravity, full columns, wins in every direction and both colors, exact draw, terminal lock, reversible scores, redo branching, latest-ten archive and read-only replay.'),
 ('Private branching studies','Fork any replay position; frozen source snapshot; nested alternatives, child reuse, rename, selection, comparison and competitive-score isolation.'),
 ('Transactional subtree transplant','Preview every derived position, recursive identity-preserving merges, same-study frozen traversal, illegal-descendant rollback, dual-revision conflicts and durable retry receipts.'),
 ('Bounded tactical proofs','Depths 1-4, terminal-before-horizon evaluation, adversarial win/loss/draw/unknown outcomes, shortest wins, longest resistance, complete ordered proof and browsable board positions.'),
 ('Persistence and presentation','Two process restarts, SQLite state and receipt durability, input rejection/ownership; keyboard/focus, pending feedback, reduced motion and 375px layouts; six Visual axes.'),
]

ORACLE='Oracle scored 0.9917 overall: all 42 Functional criteria passed, with Render, Constraints and Polish also at 1.0. Visual was 0.9583. Only visual_spacing_and_layout received 4/5 rather than 5/5: the judge noted imbalance in the wide completed-matches card and tall analysis workspace. This is not an overall 1.0 result. The prior analysis pending-input and restart observations passed in this run.'
GPT='GPT-mini scored 0.1766 with both gates passed. Only the weight-2 seeded_state_import_and_isolation criterion passed Functional (2/65.5 = 0.0305). The exported UI and manifest omit New game, a required workflow entry point; many later failures are blocked setup, not separately demonstrated algorithm defects. Polish also reports absent replay Previous/Next/Close controls and a TypeError leaving analysis boards and selectors empty.'
GEMINI='Gemini scored 0.7804 and passed 35/42 Functional criteria. Recorded failures concern keyboard Undo/Redo focus, malformed operation identifiers in analysis and transplant commits, tactical defence/loss calculations, full-column recommendations, stale report invalidation and extra report fields. Polish deductions concern clipped mobile analysis, repeated pending commit activation and lost focus/feedback. Its overall score remains above 0.7; only GPT-mini meets the stated below-0.7 target in this comparison.'
HAIKU='Haiku scored 0.0000 because local_refresh_and_health failed: the judge observed HTTP 200 health/game responses but a blank authenticated page and a null-status TypeError after reload. This is a Constraints-gated zero, not absence of all working code. Its Functional judge recorded inverted row coordinates, stale winner display, draw-archive Undo errors and missing analysis/transplant/tactical surfaces. Some multi-tab checks used shared storage rather than the requested isolated contexts and were unverified.'
CAVEATS=[
 'GPT analysis creation uses a native browser prompt for the name. The Functional explanation that the creation name field was hidden does not match that code path; the hidden field is for renaming. A dismissed/unhandled native prompt can produce the reported name-required message. Without exported detailed judge actions, that creation failure is not a cleanly established missing-input defect. Other dimensions report a separate analysis-render TypeError; these are distinct observations.',
 'GPT cross_tab_sign_out_revocation observed distinct tokens, proactive sign-out and old-token 401 rejection, but post-revocation re-login verification was unfinished after a tool timeout. Do not describe the failed criterion as proof that logout revocation is broken.',
 'Missing New game and inaccessible studies cause many dependent GPT failures. Their number cannot be interpreted as independent evidence of 41 different algorithm defects. The recorded score is preserved, not corrected or presented as a complete isolated test of its backend.',
 'Haiku multi-tab evidence was limited by a shared-context reload failure. Its main reload defect is also reported separately by Constraints; the unexecuted distinct-session probes are not additional demonstrated session bugs.',
 'The exports contain all criterion verdicts and no trial-level exceptions, but that does not mean every blocked or unverified subcheck executed. This delivery is not blanket fairness certification. No local browser regrade of these model submissions was performed during final packaging.',
 'One current exported attempt per model is included. This is not a repeatability study. Oracle is above 0.95 with Functional 1.0, not overall 1.0; Gemini is above 0.7 and Haiku is a gate-zero. Administrative acceptance is not asserted.',
]

def reports(records):
    case=Report('Case Study - Dropline Four Connect','case')
    intro(case,'A familiar board game with durable branching studies, atomic subtree reuse and bounded tactical proofs')
    case.heading('1. What the task is')
    case.paragraph('Build a complete two-person Connect Four web application with private saved games and analysis tools. The visible game must remain consistent with SQLite through undo, redo, sign-out, concurrent tabs and server restart. A static board or attractive front end alone is insufficient.')
    case.table(['Feature area','Required behavior'],FEATURES,[2600,7840])
    case.heading('2. What is verified')
    case.paragraph('58 independently reported criteria across five batched dimensions: Render 1, Constraints 2, Functional 42, Polish 7 and Visual 6. Functional criterion weights total 65.5. Real UI journeys and captured legitimate requests test behavior; exact root/node fixtures and read-only full-proof traversal avoid random gameplay. Shared setups retain separate verdicts.')
    case.paragraph('Codex judge: gpt-5.6-luna, temperature 0, configured reasoning effort max. Render and Constraints are gates; otherwise Overall = 0.6 x Functional + 0.2 x Polish + 0.2 x Visual. Public networking is enabled for agent and separate verifier. Agent timeout is 7200 seconds; verifier timeout is 13200 seconds.')
    case.heading('3. Where the runs landed');score_table(case,records)
    for title,text in [('Oracle',ORACLE),('GPT-5.4 mini',GPT),('Gemini 3.7 Flash',GEMINI),('Claude Haiku 4.5',HAIKU)]:
        case.heading(title,2);case.paragraph(text)
    case.heading('4. What the separation demonstrates')
    case.paragraph('The golden solution demonstrates complete Functional coverage under the recorded judge, while GPT-mini fails basic workflow entry points despite a relatively strong Visual score. Gemini implements substantially more behavior but loses specific state-validation, search and interaction checks. This is evidence of distinct implementation outcomes, not proof of stable model rankings across repeated runs.')
    case.heading('5. Interpretation limits')
    for text in CAVEATS:case.bullet(text)
    case.heading('6. Delivery and provenance')
    case.paragraph('The task ZIP, four complete named job archives (Oracle includes no-op), and companion evaluation report are supplied. Current source matches the task ZIP, all exported verifier hashes match it, and every golden app file matches the Oracle app export. Task files and scores were not changed for this delivery.')
    case.paragraph('Task ZIP SHA-256: '+TASK_SHA,size=16)
    case.save(OUT/f'CASE-STUDY-{SLUG}.docx')

    ev=Report('Dropline Four Connect - Evaluation Report','eval')
    intro(ev,'Golden Oracle, model outcomes, criterion-level results and evidence limitations')
    ev.heading('Headline');ev.paragraph(ORACLE);score_table(ev,records)
    ev.heading('Task description and verifier design');ev.table(['Area','Coverage'],FEATURES,[2600,7840])
    ev.paragraph('Runtime: Node.js/Express on 0.0.0.0:3000, vanilla browser JavaScript and SQLite at /app/dropline.db; entry node /app/server.js. Public agent and separate-verifier networks. Provider credentials are supplied by the platform, never embedded in the task. Codex / gpt-5.6-luna / max reasoning, temperature 0.')
    ev.table(['Dimension','Criteria','Budget','Aggregation / role'],[[d.title(),str(len(records['oracle']['details'][d]['criteria'])),str(records['oracle']['details'][d]['judge']['timeout'])+' s','all_pass gate' if d in DIMS[:2] else 'weighted mean / '+{'functional':'60%','polish':'20%','visual':'20%'}[d]] for d in DIMS],[2000,1500,1700,5240])
    ev.paragraph('If Render <= 0 or Constraints <= 0: Overall = 0. Otherwise: Overall = 0.6 x Functional + 0.2 x Polish + 0.2 x Visual. Scores are rounded to four decimals. Functional counts are not weighted scores. Visual raw 4/5 normalizes to 0.75 and raw 5/5 to 1.0; the gate handles an unreviewable page separately.')
    ev.heading('Observed grading time')
    rows=[]
    for r in records.values():
        t=r['result']['verifier'];sec=(datetime.fromisoformat(t['finished_at'])-datetime.fromisoformat(t['started_at'])).total_seconds()
        rows.append([r['label'],f'{int(sec//60)}m {round(sec%60):02d}s','No trial-level exception'])
    ev.table(['Run','All-verifier elapsed','Exported status'],rows,[3500,2200,4740])
    ev.paragraph('These are complete verifier-phase elapsed times, not per-criterion budgets. Oracle completed in about 50 minutes. No trial-level timeout was recorded, but GPT has an individual tool timeout in its sign-out explanation. Platform static/rubric QC output was not supplied with these trial exports; successful execution is not a substitute for claiming 53/53 QC evidence.')
    ev.heading('Findings and limitations')
    for label,text in [('Oracle',ORACLE),('GPT-mini',GPT),('Gemini',GEMINI),('Haiku',HAIKU)]:ev.heading(label,2);ev.paragraph(text)
    for text in CAVEATS:ev.bullet(text)
    ev.page_break();ev.heading('All 58 verifier outcomes')
    ev.paragraph('These reproduce exported verdicts without changing scores. Fail includes blocked/unverified observations where the judge assigned zero; it does not always mean an independently exercised defect. Raw Visual values are shown as /5.')
    for dim in DIMS:
        ev.heading(dim.title(),2);rows=[]
        for i,c in enumerate(records['oracle']['details'][dim]['criteria']):
            row=[c['id'].replace('_',' '),str(c['weight'])]
            for r in records.values():
                x=r['details'][dim]['criteria'][i]
                row.append(str(x['raw'])+'/5' if dim=='visual' else 'Pass' if x['value']==1 else 'Fail')
            rows.append(row)
        ev.table(['Criterion','Weight','Oracle','GPT-mini','Gemini','Haiku'],rows,[4800,800,1210,1210,1210,1210],size=16)
    ev.page_break();ev.heading('Exported non-full-credit explanations')
    ev.paragraph('The following are the judges\' recorded explanations, not endorsed causal conclusions. In particular the GPT native-prompt and unfinished revocation observations are qualified in the findings above.')
    for r in records.values():
        ev.heading(r['label'],2)
        for dim in DIMS:
            for c in r['details'][dim]['criteria']:
                if c['value']<1:
                    ev.paragraph(dim+' / '+c['id'].replace('_',' '),bold=True,size=19)
                    ev.paragraph(c['reasoning'],size=19)
    ev.heading('Run and source index')
    for r in records.values():ev.paragraph(r['label']+': '+r['job']+' / '+r['path'].name,size=17)
    ev.paragraph('No-op: '+JOBS['oracle'][0]+' / dropline-four-connect__zndFqyn',size=17)
    ev.paragraph('Platform task checksum: '+CHECKSUM,size=16)
    ev.paragraph('Task ZIP SHA-256: '+TASK_SHA,size=16)
    ev.paragraph('All 39 task files match current source; the 12 prompt/judge/runner/reward hashes match each graded export; Oracle solution files match the golden source. Original exports are untouched. Job ZIP copies redact detected provider credentials; score files, verdicts and reasoning are preserved. Full archive hashes and any exclusions/redactions are recorded outside the upload folder in submission-preparation-20260914/package-audit.json.')
    ev.paragraph('Fresh final-archive local standard/upload checks are recorded alongside the packaging audit. Historical r6 local evidence includes 49 regression groups, four shared browser journeys and the pending-pointer regression. Packaging did not rerun those browser tests, rebuild Docker images or start paid runs. No claims of new runtime validation are made from historical local checks.')
    ev.save(OUT/f'EVAL-REPORT-{SLUG}.docx')

def main():
    assert not OUT.exists(),'Refuse to overwrite a final delivery.'
    assert sha(SOURCE_ZIP.read_bytes())==TASK_SHA
    before, runs_before = hashes(TASK), hashes(RUNS)
    template_hashes={k:sha(p.read_bytes()) for k,p in TEMPLATES.items()}
    with zipfile.ZipFile(SOURCE_ZIP) as z:
        assert len(z.namelist())==39 and z.testzip() is None
        assert {n.split('/',1)[1]:sha(z.read(n)) for n in z.namelist()}==before
    records,nop=evidence()
    OUT.mkdir();shutil.copy2(SOURCE_ZIP,OUT/SOURCE_ZIP.name)
    jobs,secrets=prior.build_job_zips(records)
    reports(records)
    expected=sorted([f'{SLUG}.zip',f'CASE-STUDY-{SLUG}.docx',f'EVAL-REPORT-{SLUG}.docx']+[f'{SLUG}-{k}-job-directory.zip' for k in JOBS])
    assert sorted(p.name for p in OUT.iterdir())==expected
    assert hashes(TASK)==before and hashes(RUNS)==runs_before
    assert {k:sha(p.read_bytes()) for k,p in TEMPLATES.items()}==template_hashes
    audit=dict(prepared_at=datetime.now(timezone.utc).isoformat(),delivery=str(OUT),task_zip_sha256=TASK_SHA,platform_task_checksum=CHECKSUM,files=hashes(OUT),job_archives=jobs,provider_values_redacted=secrets,source_unchanged=True,original_runs_unchanged=True,reference_docs_unchanged=True,template_hashes=template_hashes,source_hashes=before,recorded_scores={k:r['rewards'] for k,r in records.items()},oracle_functional_42_of_42=True,all_12_verifier_hashes_match_each_graded_trial=True,score_arithmetic_verified=True,no_op=nop['verifier_result']['rewards'],not_performed=['paid runs','fresh browser regrade','fresh Docker builds','platform rubric QC'],caveats=CAVEATS)
    (HERE/'package-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    print(json.dumps({k:audit[k] for k in ['delivery','files','provider_values_redacted','source_unchanged','original_runs_unchanged','oracle_functional_42_of_42']},indent=2))

if __name__=='__main__':main()

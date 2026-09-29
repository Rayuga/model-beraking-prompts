import hashlib
import json
from collections import Counter
from pathlib import Path

out = Path(__file__).resolve().parent
base = out.parent
report = json.loads((base/'release-2026-09-28/qc_findings.json').read_text(encoding='utf8'))
audit = json.loads((out/'source_audit.json').read_text())
assert audit['failed'] == 0
assert audit['source_hashes'] == report['candidate']['source_sha256']
checks = report['tasks'][0]['checks']
labels = [
 'Natural product request','Natural human voice','Clean wording and task identity','Deliverables and runtime stated',
 'No grader leakage','Achievable and unambiguous','Real working product','Coherent task identity',
 'Agent environment/network','Verifier isolation, model and credentials','Timeout fits workload','No prebuilt image override',
 'Correct assets','Consistent seed data','Docker environment builds','No answer leakage',
 'Golden covers deliverables','Golden passes every graded dimension','Golden follows runtime contract','Frozen/reproducible golden',
 'Verifier safely emits reward','Verifier can launch and grade','Instructions match verifier runtime','Correct grading wiring',
 'Prompts use browser evidence','Coverage of requested requirements','No unrequested requirements','Independent criteria',
 'Correct global browser gates','Positive controls for negative checks','Complete finite-set checks','Browser-decidable outcomes',
 'Self-consistent descriptions','Real interactions and viewports','Real process-restart persistence','Probes need fresh work',
 'Later judges tolerate state changes','Independent batched scores','Low score for shells/mocks','Graded partial reward',
 'Appropriate binary/Likert scales','Monotone reward ranking','Gates before shaping, zero reward mass','Honest weights',
 'Prompt-injection resistance','Tests/secrets isolated from app','Pinned/reproducible verifier','Consistent dimension prompts',
 'Cross-file consistency','Clean task folder','Files parse and execute','No leaked secrets','Distinct authored task',
]
risks = {
 1:'No concrete issue found; naturalness is still a judgment call.',
 2:'Human-voice scoring is subjective; a different reviewer may interpret tone differently.',
 3:'Some internal shared-procedure headings have cosmetic encoding artifacts; no conflicting public requirement found.',
 4:'Browser-only checks cannot prove the implementation actually uses React/Express/SQLite.',
 10:'Configuration matches template, but the local provider credential returned401 User not found. Platform credentials are separate and untested.',
 11:'Canonical nesting fits, but complete judge duration is unmeasured;42 functional outcomes still need an actual timed run.',
 15:'Existing images execute current mounted files; a fresh end-to-end image rebuild was not performed in this review.',
 17:'Scripted groups cover the main behaviors; this is not a complete judge verdict for every row.',
 18:'Oracle1.0 remains unverified: real judge was blocked before grading by authentication. Visual ratings also remain unmeasured.',
 20:'Source/ZIP hashes are fixed, but timestamps and order references vary legitimately; changes are not yet pushed.',
 21:'The unchanged template writes zero after whole-suite infrastructure failure. The auth-blocked run demonstrates why that zero must not be called an app failure.',
 22:'App and browser launch work; real grading is blocked by local provider401, not by a demonstrated app failure.',
 26:'Mobile coverage gap is fixed. Hidden framework/database identity is still not provable through UI alone.',
 28:'Shared workflows still have prerequisite controls. No concrete unrelated bundling defect found; hosted interpretation is unmeasured.',
 32:'Exact image identity needs reference assets; hidden database/framework identity cannot be established by browser behavior alone.',
 37:'A severely broken earlier write can contaminate shared state; current procedures read baselines, but not every broken implementation has been tested.',
 39:'Known static/localStorage-only shell is blocked; no exhaustive adversarial mock implementation evaluation.',
 40:'No measured model-score distribution; whole-process infrastructure failures still produce the shared zero fallback.',
 41:'Visual anchors are valid, but aesthetic scores are subjective.',
 42:'Algebra is monotone; empirical ranking across real submissions remains unmeasured.',
 45:'Instructions defend against injection; no comprehensive adversarial injection run was performed.',
 47:'LLM output, scheduling and mutable image tags prevent a strict deterministic-result guarantee. Public network is allowed.',
 51:'Local parsing/execution passes; the private platform checker executables were not run, and judge grading was auth-blocked.',
}
updates = {
 10:('Note','verifier.env and five judge headers match template. A real canonical run reached the configured provider but received401 User not found; an independent authenticated key check also returned401.'),
 17:('Note','Fresh13 commerce groups and9 browser groups passed with no page errors; the unchanged golden also passed20 mobile assertions. This supports features but does not certify all judge verdicts.'),
 18:('Not exercised','Real configured Oracle-style verification was attempted, but no judge verdict completed because provider authentication failed. The default zero reward is not a measured golden score.'),
 21:('Note','Canonical test.sh launched the golden and initialized reward safely. Authentication retries were stopped and the normal fallback retained zero; completion exit0 does not imply grading success.'),
 22:('Note','Real image, app, RewardKit and Claude process launched. Provider401 prevented browser judging; local Playwright checks ran successfully separately.'),
 34:('Pass','Fresh browser suite exercised actual keys/focus, filters/sorts, theme changes, clean contexts, reload, lost response and cancellation race. Exact mobile tour passed on all required screens.'),
 51:('Note','Current TOML/JSON and bash parse;94 source assertions pass. Fresh13 commerce and9 browser groups pass. Private platform QC not run; live judge could not authenticate.'),
}
assert len(checks)==len(labels)==53
for i,c in enumerate(checks,1):
 if i in updates:c['verdict'],c['evidence']=updates[i]
 c['potential_issue']=risks.get(i,'None identified in the current local review.')
 c['display_name']=labels[i-1]
 if c['verdict']=='Note':c['run_verdict']='PARTIAL'
 if c['verdict']=='Not exercised':c['run_verdict']='NOT EXERCISED'
counts=dict(Counter(c['verdict'] for c in checks))
report['scope']='Current-source53-row quality review, including fresh local golden tests and an authentication-blocked real judge attempt. Pass is local evidence, not hosted acceptance. Notes are limitations, not fabricated passes.'
report['evidence_binding'].update(task_source_hashes=audit['source_hashes'],local_source_assertions={'passed':94,'failed':0},actual_judge_attempted=True,actual_judge_completed=False,provider_auth_status=401,judge_zero_is_not_a_golden_score=True,fresh_commerce_groups=13,fresh_browser_groups=9,mobile_assertions=20)
report['tasks'][0]['findings'].append(dict(id='LOCAL_AUTH',check='verifier_is_isolated_pinned_and_credentialed / verifier_image_can_launch_and_grade',severity='P1',run_verdict='CONFIRMED',title='Local judge credential rejected',evidence='../oracle-live-2026-09-28/provider_error.json records repeated401 User not found before any browser grading; authenticated key endpoint also returned401.',impact='Blocks actual local judge verdicts. It does not establish an app defect or a platform credential problem.',fix='Configure a valid credential before a full judge run; user has requested local browser checks meanwhile. Never put credentials in task files.'))
(out/'qc_findings.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
header='''# Ridgeline: all 53 QC rows

ZIP first: [current Ridgeline ZIP](../release-2026-09-28/ridgeline-print-storefront.zip).

The ZIP matches current source exactly. Its SHA256 is `14cd3d3ad888f702fcfb39f650e59aecf9a86934badc06744ff4839c4ccb05e4`.

**Pass** means supported by local source inspection or executed tests. **Note** means a limitation remains and is not an unconditional pass. **Not exercised** means the needed end-to-end evidence is unavailable. These53 rows review the task and grading design; they are different from the57 app-scoring criteria. The private hosted QC checker has not been run.

Fresh evidence:94/94 source assertions;13/13 commerce groups and9/9 browser groups, with no page errors;20/20 mobile browser assertions on the unchanged golden. The real configured judge was attempted, but OpenRouter returned401 User not found before grading. Its default zero is not a golden failure. No full Oracle or target-model score is claimed.

'''
header+='Local dispositions: '+', '.join(f'{n} {v}' for v,n in counts.items())+'. No confirmed task-source defect remains in this review; local judge authentication is a separate confirmed blocker.\n\n'
header+='| # | QC check | Local verdict | Evidence / what was checked | Potential issue or limitation |\n|---|---|---|---|---|\n'
for i,c in enumerate(checks,1):
 vals=[str(i),c['display_name'],c['verdict'],c['evidence'],c['potential_issue']]
 header+='| '+' | '.join(v.replace('|','/').replace('\n',' ') for v in vals)+' |\n'
header+='''
## Earlier five Ridgeline flags

The unrequested postage-band/grams display was removed (it produced two QC flags). Search/filters/sorts have separate outcomes, mobile usability is not scored again as visual composition, public CDN assets are allowed, and the independent-context browser recipe was exercised locally. These fixes are present in the supplied ZIP; hosted acceptance remains to be observed.

## Evidence files

- `source_audit.json`:94 fresh local source assertions.
- `../oracle-live-2026-09-28/local-verification/commerce/commerce/results.json`:13 fresh commerce groups.
- `../oracle-live-2026-09-28/local-verification/browser/boundary-observations.json`:nine fresh browser groups.
- `../continuation-fixes-2026-09-28/mobile-probe/boundary-observations.json`:20 assertions for the exact mobile criterion now applied.
- `../golden-difficulty-review-2026-09-28/harness/results.json`:actual canonical launch/restart; judge scores there were synthetic.
- `../oracle-live-2026-09-28/provider_error.json`:real provider authentication failure, not an app verdict.
- `qc_findings.json`:all53 exact check IDs and48 static-requirement dispositions.

No task source changed during this check. No credential is included in the ZIP or this report.
'''
(out/'QC_53_ROW_TABLE.md').write_text(header,encoding='utf8')
print(json.dumps({'quality_dispositions':counts,'all53_rows_have_potential_issue_field':all(c['potential_issue'] for c in checks)},indent=2))

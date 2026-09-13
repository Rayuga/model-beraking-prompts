import csv
import hashlib
import json
from pathlib import Path
import sys
import tomllib

sys.stdout.reconfigure(encoding='utf-8')
out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/common-ground-ballot'
runs_root = root / 'run-outputs/common-ground-ballot'
dims = ['render', 'constraints', 'functional', 'polish', 'visual']


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def relative(path):
    return path.relative_to(root).as_posix()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


judges = {d: tomllib.loads((task / f'tests/{d}/judge.toml').read_text(encoding='utf-8')) for d in dims}
intended = {c['id']: (d, c) for d, j in judges.items() for c in j['criterion']}
records = []
for run in sorted(runs_root.iterdir()):
    if not (run / 'result.json').exists():
        continue
    job = load(run / 'result.json')
    for trial in sorted(run.glob('common-ground-ballot__*')):
        data = load(trial / 'result.json')
        agent = data['agent_info']
        model = (agent.get('model_info') or {}).get('name') or agent['name']
        rewards = data['verifier_result']['rewards']
        assert rewards == load(trial / 'verifier/reward.json')
        assert abs(float((trial / 'verifier/reward.txt').read_text()) - rewards['reward']) < .00001
        provenance = load(trial / 'verifier/prompt-provenance.json')
        checks = {}
        for dim in dims:
            for key, filename in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]:
                checks[f'{dim}/{filename}'] = provenance['judges'][dim][key] == sha(task / 'tests' / dim / filename)
        for key, filename in [('runner_sha256', 'test.sh'), ('reward_sha256', 'reward.toml')]:
            checks[filename] = provenance[key] == sha(task / 'tests' / filename)
        details_file = trial / 'verifier/reward-details.json'
        details = load(details_file) if details_file.exists() else {}
        criteria = []
        for dim, section in details.items():
            for c in section['criteria']:
                expected = intended.get(c['id'])
                assert expected and expected[0] == dim
                assert c['weight'] == expected[1]['weight'] and c['description'] == expected[1]['description']
                criteria.append({k: c[k] for k in ('id', 'value', 'raw', 'weight', 'reasoning')} | {'dimension': dim})
        ids = [c['id'] for c in criteria]
        no_op = bool(rewards['no_op'])
        assert len(set(ids)) == len(ids)
        assert no_op or set(ids) == set(intended)
        derived = 0.0 if rewards['render'] <= 0 or rewards['constraints'] <= 0 else round(
            .6 * rewards['functional'] + .2 * rewards['polish'] + .2 * rewards['visual'], 4)
        assert abs(derived - rewards['reward']) <= .0001
        assert data['exception_info'] is None and data['finished_at']
        assert all(checks.values()), (model, checks)
        func = [c for c in criteria if c['dimension'] == 'functional']
        records.append({
            'model': model, 'run': run.name, 'trial': trial.name,
            'result_file': relative(trial / 'result.json'),
            'details_file': relative(details_file) if details else None,
            'finished_at': data['finished_at'], 'job_errors': job['stats']['n_errored_trials'],
            'rewards': rewards, 'recomputed_reward': derived,
            'provenance_checks': checks, 'prompt_versions': {d: provenance['judges'][d]['prompt_version'] for d in dims},
            'counts': {
                'criteria_returned': len(criteria), 'full_credit': sum(c['value'] == 1 for c in criteria),
                'zero_credit': sum(c['value'] == 0 for c in criteria),
                'functional_passed': sum(c['value'] == 1 for c in func),
                'functional_failed': sum(c['value'] == 0 for c in func),
                'functional_earned_weight': sum(c['value'] * c['weight'] for c in func),
                'functional_total_weight': sum(c['weight'] for c in func),
            },
            'formal_model_band': .1 <= rewards['reward'] <= .7 if model not in ('oracle', 'nop') else None,
            'gate_failed': not no_op and (rewards['render'] <= 0 or rewards['constraints'] <= 0),
            'criteria': criteria,
        })

by_model = {r['model']: r for r in records}
oracle = by_model['oracle']
gemini = next(r for r in records if 'gemini' in r['model'])
gpt = next(r for r in records if 'gpt' in r['model'])
haiku = next(r for r in records if 'haiku' in r['model'])
oracle_app = runs_root / oracle['run'] / oracle['trial'] / 'artifacts/app'
golden_files = {p.relative_to(task / 'solution').as_posix():
                (oracle_app / p.relative_to(task / 'solution')).exists()
                and p.read_bytes() == (oracle_app / p.relative_to(task / 'solution')).read_bytes()
                for p in (task / 'solution').rglob('*')
                if p.is_file() and p.name != 'solve.sh' and 'node_modules' not in p.parts}

classifications = {
    'oracle': {
        'draft_edit_and_open_lock': ('judge_procedure', 'Current-revision edit refusal was not captured while the ballot was Open; the judge progressed to Published.'),
        'single_choice_private_vote': ('judge_evidence_loss', 'Visible voting and privacy worked, but the successful Owen request/response capture was lost.'),
        'close_boundary_and_hidden_results': ('judge_procedure', 'The judge did not capture a fresh Member non-2xx vote refusal while Closed; hidden results and the close transition succeeded.'),
    },
    gemini['model']: {
        'fixed_eligibility_snapshot': ('judge_procedure', 'The ineligible Owen probe was sent only after publication; a terminal-state refusal cannot establish eligibility enforcement.'),
        'cross_ballot_choice_rejection': ('judge_procedure', 'A later cross-ballot request returned 400 unchanged, but the required pre-participation rejection plus legitimate positive control was not established.'),
        'vote_retry_idempotency': ('app_defect_source_confirmed', 'api.js checks current status/revision before looking up an existing operation receipt, so exact original retries conflict with the revision changed by the first vote.'),
        'close_boundary_and_hidden_results': ('judge_evidence_gap', 'Close and fresh Member refusal were observed, but hidden-results evidence was missing for all required roles before publication.'),
        'stale_revision_and_terminal_safety': ('judge_procedure', 'The stale probe targeted an invalid lifecycle state; the fractional-revision refusal does not replace a valid previous-revision conflict probe.'),
        'durable_reauthentication_and_seed_safety': ('app_defect_source_confirmed', 'Sessions/data/restarts persisted, but replay after publication is rejected before the receipt lookup. This is a second consequence of the same replay-order bug.'),
        'accessible_keyboard_forms': ('app_defect_judge_observed', 'The judge reports missing visible focus, escaping dialog focus, Escape not closing, and no trigger-focus restoration; not independently browser-retested here.'),
    },
    gpt['model']: {
        'draft_validation_and_creation': ('app_defect_source_confirmed', 'The Ballots UI edits only drafts[0] and exposes Save draft/Open this draft; there is no visible create workflow. Source agrees with the judge.'),
        'draft_edit_and_open_lock': ('blocked_by_missing_creation', 'The distinctive Verifier draft could not be created; the full edit/open/lock sequence was not performed.'),
        'fixed_eligibility_snapshot': ('blocked_by_missing_creation', 'Existing Courtyard and roster controls worked, but new Verifier/Future snapshots could not be established.'),
        'cross_ballot_choice_rejection': ('blocked_by_missing_creation', 'The new Verifier ballot was unavailable for the required pre-vote cross-ballot probe.'),
        'single_choice_private_vote': ('judge_evidence_loss', 'Visible votes, privacy, invalid-input refusals and published totals worked; exact successful request/response evidence was not retained.'),
        'vote_retry_idempotency': ('judge_evidence_gap', 'No captured successful request remained to perform an exact replay; this is not an observed retry defect.'),
        'operation_id_mismatch_safety': ('judge_evidence_gap', 'No retained successful operation id/request remained for the mismatch probe.'),
        'approval_selection_limits': ('blocked_by_missing_creation', 'The Open Verifier approval ballot was unavailable; the limits workflow was not executed.'),
        'identified_turnout_without_choice_link': ('mixed_dependency', 'Existing Courtyard privacy/turnout worked, but the new approval ballot and its one-participant check were unavailable.'),
        'close_boundary_and_hidden_results': ('judge_procedure', 'The fresh Member HTTP refusal was captured only after publication, not during the required Closed phase.'),
        'stale_revision_and_terminal_safety': ('ambiguous_wrong_state_probe', 'Terminal/older writes were refused, but a role/state error rather than stale-data feedback was recorded; the export does not establish a correct stale-only control.'),
        'audit_privacy_and_lifecycle_scope': ('mixed_dependency', 'Recorded lifecycle/membership events, privacy and refusal non-mutation worked; create/edit/open audit coverage was blocked by absent creation.'),
        'durable_reauthentication_and_seed_safety': ('mixed_dependency_and_evidence', 'Existing sessions/state survived restarts, but the successful-vote replay evidence and new Verifier records were missing.'),
    },
}
for r in records:
    for c in r['criteria']:
        if c['value'] != 0:
            continue
        if r['model'] == haiku['model']:
            category, assessment = 'shared_gate_app_startup', 'Fresh database plus submitted .seed-applied marker skips seeding, so correct demo login fails; downstream criteria were not exercised.'
        else:
            category, assessment = classifications[r['model']][c['id']]
        c['audit_category'] = category
        c['audit_assessment'] = assessment

browser = load(out / 'browser-results.json')
first_browser = load(out / 'browser-results-first-attempt.json')
marker = load(out / 'haiku-seed-marker-reproduction.json')
report = {
    'task': 'common-ground-ballot', 'review_date': '2026-09-12',
    'ready_for_delivery': False,
    'scope': 'Completed platform exports, captured source, offline disposable initialization test, and unpaid local golden Playwright regression. No new paid model or full Oracle run. Historical scores and artifacts were not changed.',
    'criterion_counts': {d: len(judges[d]['criterion']) for d in dims},
    'all_33_criteria_returned_for_each_non_nop_trial': all(r['counts']['criteria_returned'] == 33 for r in records if r['model'] != 'nop'),
    'all_prompt_runner_hashes_match_current_task': all(all(r['provenance_checks'].values()) for r in records),
    'oracle_artifact_vs_current_golden': golden_files,
    'golden_regression': {
        'result_file': relative(out / 'browser-results.json'),
        'passed_groups': sum(x['passed'] for x in browser['results']),
        'failed_groups': sum(not x['passed'] for x in browser['results']),
        'browser_errors': browser['errors'],
        'first_attempt_file': relative(out / 'browser-results-first-attempt.json'),
        'first_attempt_failed_groups': [x for x in first_browser['results'] if not x['passed']],
        'rerun_change': 'Only the external diagnostic driver gained a pre-assert screenshot and geometry logging. No application changes or weakened assertions. The first strict theme-button geometry failure did not reproduce; cause not conclusively established.',
        'oracle_score_not_overridden': True,
    },
    'haiku_reproduction': marker,
    'limits': [
        'One scored trial per model; exports have criterion explanations but no raw per-action judge transcripts.',
        'A missed or lost probe is not proof of an application defect and is not grounds to award a pass without fresh evidence.',
        'Thirty-three graded criteria does not mean every behavior was exercised: Haiku was blocked at login and GPT lacked required creation setup.',
        'A successful local regression does not establish an Oracle/platform QC score of 1.',
    ],
    'findings': [
        {'priority': 'high', 'id': 'oracle_below_acceptance', 'detail': 'Recorded Oracle 0.8928 is below 0.95. All three zero criteria report missed/lost evidence. The local golden regression executes these behaviors successfully; repair checkpoint execution/capture before claiming Oracle readiness.'},
        {'priority': 'high', 'id': 'gemini_above_band', 'detail': 'Gemini 0.7572 is above the 0.1-0.7 model band. Four failed functional criteria are procedure/evidence gaps; fixing evaluation procedure might raise the score, not reduce it.'},
        {'priority': 'high', 'id': 'haiku_zero_login_gate', 'detail': 'Haiku 0 is a reproduced fresh-database initialization defect, not a meaningful in-band functional result: a stale filesystem marker skips SQLite user seeding.'},
        {'priority': 'medium', 'id': 'gpt_mixed_failures', 'detail': 'GPT 0.5714 is numerically in band, but its 13 failed functional criteria combine missing creation, dependent blocked checks, and missing judge evidence; they are not 13 independently demonstrated defects.'},
        {'priority': 'low', 'id': 'local_mobile_probe_intermittency', 'detail': 'The first golden regression stopped at a strict mobile theme-button geometry assertion after 12 passing groups. A diagnostic rerun with identical assertions passed all 13 groups. Preserve both results and stabilize geometry measurement if used as a release check.'},
    ],
    'recommended_next_steps': [
        'Preserve all exported scores and record the current run as not ready for delivery.',
        'Make Open and Closed checkpoints explicit barriers before progressing lifecycle state; capture the open-edit refusal, all-role hidden reads and fresh-member closed refusal in their valid states.',
        'Register request/response capture before submitting each successful vote and retain the complete private evidence securely outside the app across navigation and restarts; never print session tokens.',
        'Keep all existing behavioral assertions, correct isolated stale/eligibility controls, and distinguish blocked setup from demonstrated failures.',
        'Validate the revised procedure on the golden solution, then run the full platform Oracle before making further model-run decisions. No scored rerun was started by this audit.',
    ],
    'runs': records,
}
(out / 'ballot-run-analysis.json').write_text(json.dumps(report, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
with (out / 'criterion-matrix.csv').open('w', encoding='utf-8', newline='') as stream:
    writer = csv.writer(stream)
    writer.writerow(['model', 'run', 'dimension', 'criterion', 'weight', 'value', 'audit_category', 'reasoning', 'audit_assessment'])
    for r in records:
        for c in r['criteria']:
            writer.writerow([r['model'], r['run'], c['dimension'], c['id'], c['weight'], c['value'], c.get('audit_category', ''), c['reasoning'], c.get('audit_assessment', '')])

lines = ['# Common Ground Ballot: Run Review', '', 'Status: **not ready for delivery**. Review date: 2026-09-12.', '',
         '| Run | Final reward | Functional passed | Functional | Polish | Visual |',
         '| --- | ---: | ---: | ---: | ---: | ---: |']
for r in [oracle, gpt, gemini, haiku, by_model['nop']]:
    w, counts = r['rewards'], r['counts']
    count = 'not graded' if r['model'] == 'nop' else f"{counts['functional_passed']}/19"
    lines.append(f"| {r['model']} | {w['reward']:.4f} | {count} | {w['functional']:.4f} | {w['polish']:.4f} | {w['visual']:.4f} |")
lines += ['', 'The formal model band is 0.1-0.7 and Oracle acceptance is at least 0.95. Only GPT is numerically in band. '
          'NOP zero is the expected empty-submission control. Haiku zero is not an in-band functioning app result.', '',
          '## Export Integrity', '',
          'All four jobs finished without trial errors. Every non-NOP trial returns all 33 criteria: Render 2, Constraints 2, Functional 19, Polish 4, Visual 6. '
          'All 12 prompt/judge/runner/reward provenance checks match the working task, including Functional r4 with the approval explanatory-note requirement removed. '
          'Final rewards agree across result.json, reward.json and reward.txt and with the 60/20/20 gated formula.', '',
          'Use final reward 0.8928 for Oracle, not the intermediate 0.9643 aggregate printed in rewardkit.log.', '',
          '## Golden Checks', '',
          f"The local golden suite passed {report['golden_regression']['passed_groups']} groups on its diagnostic rerun, including the three behaviors missing from Oracle evidence, exact receipt replay, and two real server restarts. "
          f"Captured Oracle application files match the current golden: {all(golden_files.values())}.", '',
          'The first local attempt passed 12 groups then stopped at the strict mobile theme-button geometry assertion. '
          'Only a screenshot before that assertion and geometry logging were added to the external driver; app and assertions were unchanged. '
          'The second attempt passed all 13 groups. The first result is preserved; its timing/geometry cause is not conclusively established. '
          'This is local regression evidence, not a replacement Oracle score.', '',
          '## Failed-Check Assessment', '']
for r in [oracle, gemini, gpt]:
    lines += [f"### {r['model']}", '']
    for c in r['criteria']:
        if c['value'] == 0:
            lines.append(f"- `{c['id']}` ({c['weight']}): **{c['audit_category']}**. {c['audit_assessment']}")
    lines.append('')
lines += ['### Haiku', '',
          'All dimensions fail the shared login gate. Correct seeded Ruth/Leila credentials returned 401 even though health and the sign-in shell loaded. '
          'The captured app includes `.seed-applied`. `database.js:126` returns early whenever that file exists; the verifier legitimately removes the declared database and its WAL/SHM files for a fresh seed but retains other app files. '
          'The marker therefore survives an empty database and prevents creation of the seeded accounts.', '',
          'Independent offline probe using the actual captured database.js and a disposable fresh SQLite database:',
          '- Marker retained: 0 users; correct Ruth authentication fails.',
          '- Marker absent: 4 users; correct Ruth authentication succeeds.', '',
          'This probe does not modify the export, invoke a provider, or replace its recorded score. It directly tests initialization/authentication, not a full HTTP/browser model rerun.', '',
          '## What To Do Next', '']
lines += [f'{i}. {text}' for i, text in enumerate(report['recommended_next_steps'], 1)]
lines += ['', 'No task files, model artifacts, rubric weights or recorded rewards were changed for this audit. '
          'No new paid run or platform QC was executed. Missing judge evidence must not be relabeled as a pass.', '',
          'Evidence: [full analysis](ballot-run-analysis.json), [criterion matrix](criterion-matrix.csv), '
          '[golden rerun](browser-results.json), [first golden attempt](browser-results-first-attempt.json), '
          '[Haiku reproduction](haiku-seed-marker-reproduction.json).', '']
(out / 'README.md').write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps({
    'report': relative(out / 'ballot-run-analysis.json'), 'readme': relative(out / 'README.md'),
    'ready': False, 'golden_source_matches': golden_files,
    'golden_regression': report['golden_regression'],
    'scores': [{k: r[k] for k in ('model', 'rewards', 'counts')} for r in records],
}, indent=2))

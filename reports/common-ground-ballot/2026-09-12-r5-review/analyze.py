import csv
import hashlib
import json
from pathlib import Path
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
dims = ['render', 'constraints', 'functional', 'polish', 'visual']
load = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda b: hashlib.sha256(b).hexdigest()
archive = root / 'deliverables/common-ground-ballot/2026-09-12-judge-r3/common-ground-ballot.zip'
with zipfile.ZipFile(archive) as z:
    source = {n.removeprefix('common-ground-ballot/'): z.read(n) for n in z.namelist()}
expected = {c['id']: (d, c) for d in dims for c in tomllib.loads(source[f'tests/{d}/judge.toml'].decode())['criterion']}
runs = []
for job in sorted((root / 'run-outputs/common-ground-ballot').glob('run-*')):
    job_result = load(job / 'result.json')
    assert job_result['stats']['n_errored_trials'] == 0
    for trial in sorted(job.glob('common-ground-ballot__*')):
        result = load(trial / 'result.json')
        agent = result['agent_info']
        model = (agent.get('model_info') or {}).get('name') or agent['name']
        rewards = result['verifier_result']['rewards']
        assert result['finished_at'] and result['exception_info'] is None
        assert rewards == load(trial / 'verifier/reward.json')
        assert abs(rewards['reward'] - float((trial / 'verifier/reward.txt').read_text())) < .00001
        derived = 0 if min(rewards['render'], rewards['constraints']) <= 0 else round(.6 * rewards['functional'] + .2 * rewards['polish'] + .2 * rewards['visual'], 4)
        assert abs(derived - rewards['reward']) < .00001
        p = load(trial / 'verifier/prompt-provenance.json')
        provenance = {d + '/' + f: p['judges'][d][key] == sha(source[f'tests/{d}/{f}'])
                      for d in dims for key, f in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]}
        provenance.update({f: p[key] == sha(source['tests/' + f]) for key, f in [('runner_sha256', 'test.sh'), ('reward_sha256', 'reward.toml')]})
        assert all(provenance.values())
        details = trial / 'verifier/reward-details.json'
        criteria = []
        if details.exists():
            for d, section in load(details).items():
                for c in section['criteria']:
                    assert (d, c['description'], c['weight']) == (expected[c['id']][0], expected[c['id']][1]['description'], expected[c['id']][1]['weight'])
                    criteria.append({'dimension': d, **c})
        assert rewards['no_op'] or {c['id'] for c in criteria} == set(expected)
        runs.append(dict(model=model, job=job.name, trial=trial.name, rewards=rewards,
                         result_file=str((trial/'result.json').relative_to(root)),
                         functional_passed=sum(c['dimension']=='functional' and c['value']==1 for c in criteria),
                         full_credit=sum(c['value']==1 for c in criteria),
                         zero_credit=sum(c['value']==0 for c in criteria),
                         partial_credit=sum(0<c['value']<1 for c in criteria),
                         model_in_band=.1<=rewards['reward']<=.7 if model not in ('oracle','nop') else None,
                         provenance=provenance, criteria=criteria))
oracle = next(r for r in runs if r['model']=='oracle')
oracle_app = root/'run-outputs/common-ground-ballot'/oracle['job']/oracle['trial']/'artifacts/app'
golden = {n.removeprefix('solution/'): (oracle_app/n.removeprefix('solution/')).read_bytes()==b
          for n,b in source.items() if n.startswith('solution/') and n!='solution/solve.sh'}
assert all(golden.values())
findings = [
    {'id':'oracle_invalid_draft_not_reproduced','severity':'high','assessment':'Oracle final 0.9595 clears the numerical 0.95 threshold but only 18/19 functional criteria pass. The claimed malformed Temp invalid request is not present in exported per-action evidence. All exact invalid draft controls reject/prevent without mutation in a browser against byte-identical captured golden source. Do not call this a confirmed app defect or override the platform result.'},
    {'id':'gpt_above_target','severity':'high','assessment':'GPT 0.7393 is above the formal 0.1-0.7 band. Blank/duplicate draft normalization, fractional lifecycle revision acceptance, repeated approval acceptance, and seeded tally multiplication reproduce. Ineligible Owen and cross-ballot Leila are correctly rejected in isolated probes, contrary to broad failed-check wording. Single-choice exchange failure is explicitly missing evidence. Correcting evaluation may raise scores; no range guarantee.'},
    {'id':'haiku_refresh_gate','severity':'high','assessment':'Login succeeds but refresh returns to sign-in. Reproduced in browser; sessionId is only an in-memory global. All 33 zero criteria reflect one failed shared gate, not 33 independent feature defects.'},
    {'id':'gemini_mixed_failures','severity':'medium','assessment':'Gemini 0.6536 is in band but lost original vote evidence and an approval tally defect are repeated as reasons for unrelated eligibility/retry/mismatch/duplicate failures. Repeated option input is normalized and accepted (200). Exact replay succeeds while Open (200) but fails after publication (400), independently confirming the receipt-order defect. Published replay was not actually established by the judge.'},
    {'id':'gemini_touch_threshold','severity':'medium','assessment':'Polish rationale treats 44px as a hard threshold although the brief and criterion say comfortable touch targets. A 36px control alone does not establish the full usability failure. Keyboard dialog findings are judge-observed and not independently browser-retested here. No score change made.'},
    {'id':'no_new_scores','severity':'info','assessment':'The r6 release contains revised criteria and a CSS fix. Historical r5 scores do not apply to it. Local probes are unpaid regression evidence, not Oracle or platform QC.'},
]
report = dict(task='common-ground-ballot', evaluated_prompt='functional-v1.0.0-r5', ready_for_delivery=False,
              evaluated_zip_sha256=sha(archive.read_bytes()), all_runs_completed=True,
              all_12_provenance_hashes_match_evaluated_zip=True, oracle_source_matches_evaluated_golden=golden,
              criteria_per_dimension={d:sum(v[0]==d for v in expected.values()) for d in dims},
              findings=findings, probes=load(out/'probe-results.json'), runs=runs,
              limits=['No full per-action judge transcript exported; criterion reasoning is not independently verified for every behavior.',
                      'Source-aware diagnostic API probes are not replacements for black-box grading.',
                      'The extra revision-field diagnostic is explicitly excluded from grading; it does not match the actual GPT voting payload.',
                      'No historical export or reward was modified.'])
(out/'run-analysis.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
with (out/'criterion-matrix.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f);w.writerow(['model','dimension','criterion','weight','value','reasoning'])
    for r in runs:
        for c in r['criteria']:w.writerow([r['model'],c['dimension'],c['id'],c['weight'],c['value'],c['reasoning']])
lines=['# Common Ground Ballot: New Run Review','','These are the recorded r5 results, not scores for the revised r6 package.','',
       '| Model | Reward | Functional passes | Functional | Polish | Visual |','| --- | ---: | ---: | ---: | ---: | ---: |']
for model in ['oracle','gpt-5.4-mini','gemini-3.7-flash','claude-haiku-4-5','nop']:
    r=next(r for r in runs if r['model']==model);v=r['rewards']
    lines.append(f"| {model} | {v['reward']:.4f} | {r['functional_passed']}/19 | {v['functional']:.4f} | {v['polish']:.4f} | {v['visual']:.4f} |")
lines += ['', 'All jobs finished without trial errors. Scores agree between result.json, reward.json, reward.txt and the gated 60/20/20 formula. All 12 prompt/judge/runner/reward hashes match the evaluated judge-r3 archive. Every graded app returned all 33 criteria. NOP is the expected ungraded zero.', '', '## Findings', '']
for f in findings:lines += ['### '+f['id'], '', f['assessment'], '']
lines += ['## Action Taken', '', 'See ../../../deliverables/common-ground-ballot/2026-09-12-judge-r4/ for a separate new upload, exact controls, independent scoring, post-restart result coverage, local golden tests and the mobile wrapping correction. The new package has no platform Oracle or QC result yet. No task weights, model artifacts or historical scores were changed.']
(out/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'runs':[{k:r[k] for k in ('model','rewards','functional_passed')} for r in runs], 'provenance_passed':True},indent=2))

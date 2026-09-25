import hashlib
import json
from pathlib import Path
import tomllib
import zipfile

root = Path(__file__).resolve().parents[3]
out = Path(__file__).resolve().parent
source = root / 'projects/dropline-four-connect'
sha = lambda data: hashlib.sha256(data).hexdigest()
runs = []
for path in sorted((root / 'run-outputs/dropline-four-connect').glob('run-*/dropline-four-connect__*/result.json')):
    data = json.loads(path.read_text(encoding='utf-8'))
    agent = data['agent_info']
    trial = path.parent
    detail_file = trial / 'verifier/reward-details.json'
    details = json.loads(detail_file.read_text(encoding='utf-8')) if detail_file.exists() else {}
    provenance_file = trial / 'verifier/prompt-provenance.json'
    provenance = json.loads(provenance_file.read_text())
    matches = all(sha((source / f'tests/{dim}/{file}').read_bytes()) == provenance['judges'][dim][key] for dim in ['render','constraints','functional','polish','visual'] for file,key in [('judge.toml','judge_sha256'),('prompt.md','prompt_sha256')])
    criteria = {dim:[{k:c.get(k) for k in ['id','value','raw','weight','reasoning']} for c in block.get('criteria',[])] for dim,block in details.items() if isinstance(block,dict) and 'criteria' in block}
    runs.append(dict(run=path.parent.parent.name,trial=trial.name,model=(agent.get('model_info') or {}).get('name') or agent['name'],scores=data['verifier_result']['rewards'],exception=data.get('exception_info'),verifier_hashes_match_current=matches,criteria=criteria))
(out/'run-review.json').write_text(json.dumps(runs,indent=2),encoding='utf-8')
lines=['# Dropline platform run review — September 14, 2026','','These are supplied platform results for the pre-visual-repair task, not new runs. All five verifier prompt/judge hashes match current source.','','| Model | Functional | Polish | Visual | Overall |','|---|---:|---:|---:|---:|']
for run in runs:
    s=run['scores'];lines.append(f"| {run['model']} | {s['functional']:.4f} | {s['polish']:.4f} | {s['visual']:.4f} | {s['reward']:.4f} |")
lines += ['','All completed model/Oracle trials passed Render and Constraints. No-op scored zero. No trial-level exception was reported.','',
'## Findings and interpretation','',
'Oracle passed every Functional and Polish criterion. Its five Visual deductions were typography (long names/narrow history), disconnected dark/light palettes, uneven spacing, archive/replay hierarchy, and inconsistent components. Responsive Visual received full credit. The low overall result is not a game-rule failure.','',
'GPT passed 21 of 27 Functional criteria, including seed import, archive/replay, gravity, every win/draw direction, terminal lock, undo/redo, account restoration, frozen analysis prefixes, nested branches, practice-score isolation, exact comparison, ownership, stale-analysis recovery, source independence, manifest and restart persistence. Its six reported failures and all other models’ deductions appear below.','',
'Local reproduction on the UNMODIFIED exported GPT artifact disputes three deductions: separately submitted login forms issue distinct bearer tokens; game moves and analysis moves each issue exactly one request while the first real response is held and a second physical pointer activation is attempted. The published score is unchanged. Source also contains the corresponding fresh-token generation and pending guards. These checks do not regrade every other checkpoint in the affected criteria, and the native judge action trace was not exported. See gpt-fairness.json and gpt-fairness.cjs.','',
'Genuine GPT defects reproduced locally: focus returns to BODY after a game activation; a numeric-string analysis revision is accepted; a separate fresh creation using the same source/name returns the existing analysis instead of creating a distinct one. The last defect violates the existing brief but is not specifically exposed by the current test journey. The broken child selector is supported by the exported code: child IDs are treated as node objects, producing undefined option labels/values. Analysis focus loss follows the same rerendering pattern and was reported by the judge.','',
'Gemini passed 24 of 27 Functional criteria. Its focus and extra-field rejection findings have specific evidence. The restart deduction explicitly says the Redo-between-restarts checkpoint was not completed; that is missing verification, not demonstrated data loss. Haiku passed only 3 of 27 Functional criteria: its first game mutation triggered client/server errors, so most downstream scenarios were unreachable. Its low score is not 24 independent bugs.','',
'## Difficulty recommendation','',
'Do not rerun the unchanged task hoping for a lucky sub-0.70 score. GPT and Gemini both implemented most of the substantial branching feature. Correcting questionable judging would tend to raise GPT’s score, not lower it. Keep the standard 60/20/20 formula and do not inflate weights on whichever checks happened to fail.','',
'A small coverage improvement is to check distinct same-name analyses, equal-board/different-path comparisons, and interleaved edits to two independent studies. These are existing requirements and can expose real defects, but are unlikely on their own to reliably move GPT below 0.70.','',
'For a substantial new challenge, recommend an atomic variation-editing workflow: preview and transplant a selected subtree onto another position; replay every edge under gravity/turn/terminal rules; reuse shared legal edges; reject the whole operation when a descendant becomes illegal; preserve originals and map old nodes to resulting nodes; commit with per-study revision checks and durable retry receipts. Complement this with multi-line import that shares prefixes and rolls back the entire batch on one invalid line. These are useful study features, not hidden traps. They need an explicit product brief, independent bounded criteria, golden implementation, local tests and fresh QC/Oracle. They have NOT been implemented in this visual-only package; confirm scope before that expansion. No predicted model score is claimed.','',
'## All reported deductions','']
for run in runs:
    lines += [f"### {run['model']} — {run['run']}",'']
    for dim,criteria in run['criteria'].items():
        for c in criteria:
            if c['value'] < 1:
                lines.append(f"- `{dim}/{c['id']}` ({c['value']}, weight {c['weight']}): {c['reasoning']}")
    lines.append('')
(out/'RUN-REVIEW.md').write_text('\n'.join(lines),encoding='utf-8')
baseline=out/'source-before-visual'
files={p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}
changed=[name for name,data in files.items() if not (baseline/name).exists() or (baseline/name).read_bytes()!=data]
assert set(changed)=={'solution/app/public/index.html','solution/app/public/analysis.css','solution/app/public/analysis.js'},changed
assert len(files)==36
assert all(run['verifier_hashes_match_current'] for run in runs)
cfg=tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version']=='1.0.0'
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
tests=json.loads((out/'regressions.json').read_text())['results']
assert len(tests)==27 and all(t['passed'] for t in tests)
visual=json.loads((out/'visual-regressions.json').read_text())['results']
assert len(visual)==3 and all(t['passed'] for t in visual)
archive=out/'dropline-four-connect.zip'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        assert not any(x in name for x in ['node_modules','__pycache__','.db','.sqlite','.env'])
        info=zipfile.ZipInfo('dropline-four-connect/'+name,(2026,9,14,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name,data in files.items():assert z.read('dropline-four-connect/'+name)==data
report=dict(zip=str(archive),sha256=sha(archive.read_bytes()),files=len(files),source_changes=changed,source_sha256={n:sha(d) for n,d in sorted(files.items())},criterion_changes=False,configuration_changes=False,all_run_verifier_hashes_match=True,local_groups=27,layout_groups=3,public_network_both=True,paid_runs_performed=False,fresh_docker_builds_performed=False)
(out/'package-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='source_sha256'},indent=2))

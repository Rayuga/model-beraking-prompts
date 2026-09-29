import hashlib
import json
from pathlib import Path
import re
import tomllib

root = Path(__file__).resolve().parents[3]
out = Path(__file__).resolve().parent
task = root / 'projects/colderwater-playground-devtools'
owned = ['environment/instructions/behaviour.md', 'environment/instructions/security.md', 'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
hashes = {name: sha(task / name) for name in owned}
inventory = json.loads((out / 'semantic-qc-inventory.json').read_text(encoding='utf-8-sig'))
proof = json.loads((out / 'interaction-mcp-results.json').read_text())
language = json.loads((out / 'language-mcp-results.json').read_text())
assert proof['passed'] and language['passed']
assert len(proof['observations']['observations']) == 5
assert proof['source_binding'] == language['source_binding']
for relative, digest in proof['source_binding'].items():
    assert sha(task / 'solution/app' / relative) == digest, relative
baseline = out / 'baseline-d254c73e6ebe/colderwater-playground-devtools'
assert sha(baseline / 'solution/app/src/runtime.ts') == sha(task / 'solution/app/src/runtime.ts')
dimensions = {p.parent.name: tomllib.loads(p.read_text()) for p in (task / 'tests').glob('*/*/judge.toml')}
functional = dimensions['functional']['criterion']
assert len(functional) == 33 and sum(c['weight'] for c in functional) == 49.5
assert sum(len(j['criterion']) for j in dimensions.values()) == 45
all_ids = [c['id'] for j in dimensions.values() for c in j['criterion']]
public = '\n'.join(p.read_text() for p in [task / 'instruction.md', *(task / 'environment/instructions').glob('*.md')])
assert not any(identifier in public for identifier in all_ids)
assert not re.search(r'\b(judge|rubric|criteria|verifier|reward|Playwright)\b', public, re.I)
assert not re.search(r'TODO|FIXME|CHANGE_ME|<placeholder>', public)
new_markers = ['dispatch-keyboard-marker', 'dispatch-input-marker', 'interaction-good', 'interaction-candidate', 'interaction-late', 'interaction-started', 'interaction-still-waiting']
for path in [task / 'environment/assets/seed_data.json', *(task / 'solution/app').rglob('*')]:
    if path.is_file():
        assert not any(marker in path.read_text(errors='ignore') for marker in new_markers), str(path)
prompt = (task / 'tests/scored/functional/prompt.md').read_text()
assert all(text in prompt for text in ['Playwright MCP', 'http://localhost:3000', '{criteria}', '{app_context}', 'record it and continue', 'Do not inspect submitted application implementation files'])
judge_text = (task / 'tests/scored/functional/judge.toml').read_text()
fixture = re.search(r'<!doctype html><html><body><h1 id="dispatch-mark"[^\n]+', judge_text).group()
assert fixture in (out / 'interaction-mcp-probe.js').read_text()
checks = {
    'all_five_judges_parse': True, 'functional_count': 33, 'functional_weight': 49.5,
    'all_dimension_criteria': 45, 'public_id_and_grader_hygiene': True,
    'public_draft_marker_hygiene': True, 'new_probes_not_in_seed_or_golden': True,
    'exact_expanded_language_fixture_exercised': True, 'functional_browser_and_independence_rules_retained': True,
    'golden_runtime_unchanged_from_previous_zip': True, 'current_golden_matches_both_mcp_proofs': True,
    'mcp': proof['mcp_version'], 'chromium': proof['chromium_version'], 'owned_file_hashes': hashes,
}
(out / 'semantic-scoped-checks.json').write_text(json.dumps(checks, indent=2) + '\n')

coverage = [
    ('Completed preview survives its original five seconds', 'language_dispatch', 'language-mcp-results.json', 'Successful completion then 6102ms untouched before real click'),
    ('Later keyboard and input actions start valid work', 'language_dispatch', 'language-mcp-results.json', 'Focus first, idle6107ms, then ordinary typing without a click; both markers once'),
    ('CSS copy excludes every installed fixture handler', 'language_dispatch', 'language-mcp-results.json', 'Click/key/input counts unchanged; no repeated HTML log; heading styled'),
    ('Fresh JS does not inherit old HTML globals', 'language_dispatch', 'language-mcp-results.json', 'fresh-undefined with prior heading removed'),
    ('Original Run includes its four-second timer in the same budget', 'recovery_persistence_chain', 'interaction-mcp-results.json', 'Callback entered; timeout4998ms from Run; saved record intact'),
    ('Later interaction timers share one five-second budget', 'recovery_persistence_chain', 'interaction-mcp-results.json', 'Six-second callback never runs; timeout5200ms from first click'),
    ('A second interaction during pending work cannot reset the deadline', 'recovery_persistence_chain', 'interaction-mcp-results.json', 'Second click2177ms while Waiting; no late marker after scheduled time'),
    ('Failed interaction rolls back and leaves saved work usable', 'recovery_persistence_chain', 'interaction-mcp-results.json', 'interaction-good restored; exact saved recovery source and Run still work'),
    ('Stopped/replaced interaction callbacks cannot resume', 'fresh_cancel plus shared lifecycle rule', 'interaction-mcp-results.json', 'Observed Stop and replacement beyond original four-second callbacks; no late output'),
    ('Restored pictures and CSS copies need not retain old handlers', 'language_dispatch and recovery_persistence_chain', 'public/prompt review', 'Explicit static-snapshot exception; no input-value convention imposed'),
    ('Whole workspace supports a bounded keyboard navigation route', 'labelled_controls_and_focus', 'KEYBOARD_RECHECK.md + keyboard-proof-results.json', 'Companion agent evidence: editor exit, example, saved snippet, return; primary controls reachable'),
]
(out / 'semantic-coverage.json').write_text(json.dumps({'scope': 'Changed interaction and keyboard requirements only; unchanged task coverage belongs to the coordinator report.', 'mapping': [dict(requirement=a, criterion=b, evidence=c, observation=d) for a,b,c,d in coverage]}, indent=2) + '\n')
passed_quality = {1,2,3,4,5,6,7,17,18,24,25,26,27,28,30,31,32,33,34,35,36,37,38,41,45,48,49,51,53}
passed_deterministic = {'check-instruction-content.py','check-instruction-hygiene.py','check-no-placeholders.sh','check-probe-not-in-seed.py','check-rubric-prompt.py','check-rubric-schema.py','check-batched-independence-wording.py'}
findings = {
    'scope': 'Changed files and related interaction/keyboard semantics only. All53/48 entries enumerated; Not exercised entries are intentionally delegated to the coordinator final report, not copied as prior Pass.',
    'owned_file_hashes': hashes,
    'supersedes': 'Prior broad no-ambiguity/full-coverage assurances for d254c73e6ebe94b2001ed782b136707c9cc3c5391c35c0bcd7fd66705d0c8a25; public screenshots established two real omissions. Prior passing unchanged observations remain valid evidence for their measured scope only.',
    'checks': [{'number': c['number'], 'id': c['id'], 'status': 'Pass' if c['number'] in passed_quality else 'Not exercised', 'note': ('Changed-scope manual review plus semantic-scoped-checks.json, semantic-coverage.json, interaction-mcp-results.json, language-mcp-results.json and companion keyboard evidence. This is not a claim of a fresh all-task Oracle run.' if c['number'] in passed_quality else 'Outside this semantic fix subtask; coordinator must use its actual full-task/image/harness/package evidence.'), 'findings': []} for c in inventory['quality']],
    'deterministic': [{'name': c['name'], 'status': 'Pass' if c['name'] in passed_deterministic else 'Not exercised', 'output': ('Documented equivalent applied to changed scopes; semantic-scoped-checks.json records the assertions. Proprietary platform checker was not invoked.' if c['name'] in passed_deterministic else ''), 'note': 'Scoped result; see coordinator final report for complete task-level verdict.'} for c in inventory['deterministic']],
}
assert len(findings['checks']) == 53 and len(findings['deterministic']) == 48
(out / 'qc_semantic_scoped_findings.json').write_text(json.dumps(findings, indent=2) + '\n')

def line(relative, text):
    return next(i for i,s in enumerate((task / relative).read_text().splitlines(), 1) if text in s)
behaviour = 'environment/instructions/behaviour.md'
security = 'environment/instructions/security.md'
judge = 'tests/scored/functional/judge.toml'
report = f'''# Colderwater interaction contract and keyboard coverage recheck

The two latest screenshot findings were real. Earlier broad coverage/no-ambiguity conclusions for archive `d254c73e6ebe94b2001ed782b136707c9cc3c5391c35c0bcd7fd66705d0c8a25` were too strong. This report supersedes those conclusions for these scopes; it does not erase prior evidence.

## What was wrong and what changed

The old public brief only described one five-second run and “active run” updates. Its HTML-handler criterion nevertheless expected a completed preview to respond later. A reasonable implementation could retire that old context after its first deadline and fail the criterion. `{behaviour}:{line(behaviour, 'Keep the current successfully completed')}` and `{security}:{line(security, 'Only the current preview')}` now explain that the current successful execution remains interactive, a deliberate later action starts a fresh bounded interaction, and pending work never gets its deadline extended. Stopped, failed and replaced contexts remain dead. `{behaviour}:{line(behaviour, 'That restored picture can be static')}` explicitly permits static rollback so the fix does not accidentally require reviving old handlers.

`{judge}:{line(judge, 'The new HTML replaces')}` now observes delayed click, keyboard and input handlers after completion. The input is focused before its six-second idle wait: clicking it immediately before typing would let an incorrect click-only implementation mask broken keyboard/input handling. The following CSS leg observes all three handlers removed and does not require any particular retained input value. `{judge}:{line(judge, '4. Without saving over that record')}` checks a six-second callback started by a new interaction. Another click while it is pending must not unlock that callback; timeout, rollback, absent late output and successful saved recovery are observed together.

The keyboard coverage omission is handled in the companion `KEYBOARD_RECHECK.md`. Polish now performs a bounded real keyboard route from the editor through examples and a dedicated saved snippet and back. It permits documented editor escape keys and native focus styling; it does not regrade shortcuts or persistence. The golden only needed an Escape-then-Tab help/accessible-description change. This subtask changed no golden runtime code.

## Fresh browser evidence

- `interaction-mcp-results.json`: five groups passed through installed Playwright MCP0.0.79 and Chromium152.0.7977.8, with network disabled and a fresh disposable golden process. Original four-second delayed loop timed out4998ms after Run. The new interaction's second click occurred2177ms after its first click while status was Waiting; timeout was5200ms after the first click. Its six-second callback never appeared, the previous render returned, and the original saved snippet still loaded and ran. Late keyboard/input and stopped/replaced callbacks passed too.
- `language-mcp-results.json`: exact final expanded HTML fixture passed. Delayed click at6102ms after observed completion; focused keyboard/input after6107ms idle; one marker for each. CSS retained no old handler or repeated script; fresh JS had no prior global. Only this affected group was repeated after its fixture expanded.
- Runtime SHA256 `{proof['source_binding']['src/runtime.ts']}` equals the prior archive's runtime. Final bundle SHA256 `{proof['source_binding']['public/assets/index-XwoWsDAE.js']}` is the current help-only build and matches both successful MCP proofs.
- `interaction-mcp-attempt1-modal.json` retains the first external driver's failed result parsing. MCP returned an actual discard-dialog state instead of a completed result. The corrected driver uses `browser_handle_dialog` through the protocol and retrieves the continuing callback's observations. This was a proof-driver limitation, not an application timeout failure.

## Fairness, score and limits

The added timer leg uses ordinary supported source. A reset-on-second-click bug would let the six-second callback finish inside its wrongly extended deadline, so its visible success cannot masquerade as the required timeout merely because the outer observation allowance is eight seconds. Positive controls and pending-state observations prevent absence-only passes. The prompt allows one repeat if automation misses the pending setup window.

There are still33 Functional criteria with total49.5, four Polish criteria and six Visual criteria;45 overall including two gates. No criterion IDs, weights, gates or scoring arithmetic changed. These are clearer public requirements and stronger observations, not eased bars. Conditional on the same gates/floor outcome, the two changed Functional criteria together represent `0.6 * 5 / 49.5 = 0.060606...` reward; the changed Polish criterion represents0.05. This is a contribution bound, not a predicted model-score change. The fixed Functional floor can introduce a larger discontinuity near its threshold.

`semantic-coverage.json` maps the changed promises both ways. `qc_semantic_scoped_findings.json` enumerates all53 quality and48 deterministic sheet entries and distinguishes this subtask's changed-scope evidence from unexercised whole-task checks. The coordinator's final report owns complete image/harness/archive checks and evidence reuse. No paid Oracle, target-model run or proprietary platform QC was run here; browser success does not guarantee future judge acceptance or an Oracle reward of1.

## Frozen owned files

''' + '\n'.join(f'- `{name}`: `{digest}`' for name,digest in hashes.items()) + '\n'
(out / 'SEMANTIC_FIX_REVIEW.md').write_text(report, encoding='utf-8')
print(json.dumps({'passed': True, 'quality_entries': 53, 'deterministic_entries': 48, 'owned_hashes': hashes}, indent=2))

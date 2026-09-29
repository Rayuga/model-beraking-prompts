"""Write review reports only; never modify frozen draft or task files."""
from pathlib import Path
from decimal import Decimal
import hashlib
import json
import tomllib

out = Path(__file__).resolve().parent
mapping_path = out / 'decomposition-map.json'
mapping = json.loads(mapping_path.read_text())
mapping.pop('nominal_total_ui_actions', None)
mapping.update(total_ui_actions=None, total_ui_actions_note='Unmeasured; per-protocol figures are legacy planning estimates before shared handoffs and refinements, not a current aggregate.', nominal_manual_runs_before=60, nominal_manual_runs_after=50)
mapping_path.write_text(json.dumps(mapping, indent=2) + '\n', encoding='utf-8')
validation = json.loads((out / 'draft-validation.json').read_text())
draft = out / 'draft'
for name, key in [('judge.toml', 'draft_judge_sha256'), ('prompt.md', 'draft_prompt_sha256'), ('app_context.md', 'draft_context_sha256')]:
    validation[key] = hashlib.sha256((draft / name).read_bytes()).hexdigest()
root = out.parents[3]
baseline = root / 'deliverables/colderwater-playground-devtools/two-findings-fix-2026-09-27/archive-check-5d0f1d74ae48/colderwater-playground-devtools'
validation['source_judge_sha256'] = hashlib.sha256((baseline / 'tests/scored/functional/judge.toml').read_bytes()).hexdigest()
validation['source_binding'] = str(baseline.relative_to(root)).replace('\\', '/') + '/tests/scored/functional/judge.toml'
validation['status'] = 'Review draft authored outside task; parent owns task merge. This report changes no task files and claims no provider/platform validation.'
parsed = tomllib.loads((draft / 'judge.toml').read_text(encoding='utf-8'))
original = tomllib.loads((baseline / 'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))
original_by_id = {c['id']: c for c in original['criterion']}
new_by_id = {c['id']: c for c in parsed['criterion']}
assert len(original_by_id) == 37 and len(new_by_id) == 88
assert parsed['judge'] == original['judge'] and parsed['scoring'] == original['scoring']
assert set(original_by_id) == {r['original_id'] for r in mapping['mapping']}
mapped_ids = []
for row in mapping['mapping']:
    assert Decimal(row['original_weight']) == Decimal(str(original_by_id[row['original_id']]['weight']))
    assert sum(Decimal(c['weight']) for c in row['atomic_outcomes']) == Decimal(row['original_weight'])
    for child in row['atomic_outcomes']:
        actual = new_by_id[child['id']]
        assert Decimal(str(actual['weight'])) == Decimal(child['weight'])
        assert actual['description'] == child['evidence_key'] + ': ' + child['outcome']
        assert actual['type'] == 'binary' and Decimal(str(actual['weight'])) > 0
        mapped_ids.append(child['id'])
assert len(mapped_ids) == len(set(mapped_ids)) == 88 and set(mapped_ids) == set(new_by_id)
assert sum(Decimal(str(c['weight'])) for c in parsed['criterion']) == Decimal('49.5')
validation['mapping_rechecked_against_immutable_37_and_frozen_88'] = True
validation['current_draft_judge_mcp_scoring_config_matches_immutable_baseline'] = True
prompt = (draft / 'prompt.md').read_text(encoding='utf-8')
context = (draft / 'app_context.md').read_text(encoding='utf-8').strip()
criterion_lines = [f"- '{c['name']}': {c['description']} (score: \"yes\" or \"no\")" for c in parsed['criterion']]
criterion_lines += ['', 'Respond with a JSON object. Example:', json.dumps({c['name']: {'score': 1, 'reasoning': '...'} for c in parsed['criterion']}, indent=2)]
resolved = prompt.replace('{app_context}', context).replace('{criteria}', '\n'.join(criterion_lines))
validation['resolved_prompt_utf8_bytes_text_reproduction'] = len(resolved.encode('utf-8'))
validation.pop('draft_raw_prompt_utf8_bytes', None)
validation['draft_raw_prompt_file_bytes'] = len((draft/'prompt.md').read_bytes())
validation['hash_method'] = 'sha256(read_bytes()); resolved prompt size normalizes source file newlines as installed RewardKit read_text does.'
(out / 'draft-validation.json').write_text(json.dumps(validation, indent=2) + '\n', encoding='utf-8')
lines = [
'# Complete Functional independence proposal',
'',
'Review draft of all 37 submitted Functional rows, decomposed into **88 binary outcome owners**, with **49.5 total weight** and every original parent budget preserved exactly. This subtask authored only files outside the task; the parent owns applying the reviewed candidate. Public requirements, golden implementation, models, providers, MCP profiles and budgets are unchanged by this proposal. The three frozen draft files are `draft/judge.toml`, `draft/prompt.md`, and the parent-authored `draft/app_context.md`.',
'',
'The actual platform rejection is the controlling interpretation: independent user capabilities receive independent credit even when one bounded browser scenario supplies their observations. `harbor-webdev-rubric-qc/SKILL.md:64` says, “Criteria deliberately bundle several interacting rules into one conjunctive bar”. The previous broad reading of that whole-flow allowance did not predict the platform results. The parent explicitly directs the stricter observed platform interpretation, so this skill passage is not used as an approval claim. The first 160-row exploration over-split evidence/controls, inflated output and exceeded the Linux per-argument limit. It is superseded, not an alternative to ship.',
'',
'## Prioritized findings and disposition',
'',
'1. **P0 — Bundled useful outcomes.** Import, titles, opening/examples and language modes hid partial implementations; console controls, editor features, Auto-run states, error diagnostics/restoration, Stop state and saved-record operations had the same structural risk. The full map below separates those useful outcomes while retaining intrinsic successful controls, refusal nonmutation and post-failure recovery in the result they validate.',
'2. **P0 — Independent rows must not multiply execution.** The prompt executes named protocols once in seven phases, and assigns evidence keys to their individual rows. No per-child fixture creation or repeated browser scenario is permitted. Current record/revision controls remain independent where an earlier rejected write might mutate data.',
f"3. **P0 — Oversized prompt was not runnable.** The harness demonstrated E2BIG on the 160-row and intermediate 87-row drafts. The frozen compact text reproduces the installed prompt-builder structure at **{validation['resolved_prompt_utf8_bytes_text_reproduction']:,} UTF-8 bytes**, below the locally observed 131,072-byte single-argument ceiling. Installed-builder and real local argv confirmation belongs to the independent harness report. This is larger than the submitted 79,343-byte prompt; it is not claimed to reduce prompt tokens.",
'4. **P1 — Original browser workload needed real reduction.** Eleven redundant ordinary control Runs are replaced by actual successful state handoffs. With one new manual Run while Auto-run is enabled, the nominal successful-path floor changes from **60 to 50 explicit manual Runs**. Required time windows, all five unsupported families, both network mechanisms, exact error sources, nine privacy paths and one restart remain. Conditional fallback controls may restore some cost after failures. Total browser actions and provider cost are not measured.',
'5. **P1 — Valid alternatives and local failures.** The draft allows pending DOM to remain hidden, prevented second input, static rollback, observed public-asset role overlap, proactive stale-Save prevention, unspecified controls/routes/editor packages, arbitrary consistent indentation width, and reselection before Shift+Tab. Lowercase import/dispatch fallbacks and manual indentation prevent unrelated features from inheriting case or Tab defects. Backend filename probes have their own successful saved-record fallback if import UI fails.',
'6. **P2 — Coverage remains bounded.** The draft adds the already-public manual-Run-with-Auto-run-on proof, reverse-copy independence, source-only dirty indication and inherited CSS-style observation. It does not claim exhaustive testing of callbacks, error-language combinations, filenames, public-file paths or network mechanisms. The gaps ledger below is a limitation report, not a hidden expansion of product scope.',
'',
'## Full 37 → 88 map',
'',
'Numbers are exact Decimal weights. Each row conserves its original weight; the right-hand keys are also the short descriptor evidence suffixes. Scenario names identify protocol ownership, not required numeric execution order. Public paths below are relative to `environment/instructions/` except `instruction.md`.',
'',
'| Source scenario / original ID | Public requirement | Original weight | Independent outcome allocations |',
'| --- | --- | ---: | --- |',
]
for row in mapping['mapping']:
    assert sum(Decimal(c['weight']) for c in row['atomic_outcomes']) == Decimal(row['original_weight'])
    allocations = '; '.join('`' + c['evidence_key'].split('.',1)[1] + '` ' + c['weight'] for c in row['atomic_outcomes'])
    lines.append(f"| {row['scenario']} `{row['original_id']}` | {row['public_requirements']} | {row['original_weight']} | {allocations} |")
lines += [
'',
'The six import outcomes separate transfer/edit/save, nonexecution, unsupported import, unsupported saved extension, path rejection, and extension-case support. The extra filename-policy split is deliberate: extension validation and single-basename validation can be implemented independently. The five title outcomes separate normalization, rename-only behavior, collision protection, empty-title rejection and case-sensitive coexistence. A collision’s UI refusal and server refusal remain the same end-to-end uniqueness invariant, with both layers observed. Case variants across import/save or JS/HTML/CSS are representative enforcement of the same case-insensitive rule, not separate rewards for each spelling.',
'',
'Within error scenarios, message, user-source line and restoration have separate scores. Recovery remains intrinsic to restoration. Console duration, history, scroll policy and Clear are separate features; the two branches of scroll policy are one coherent reading-position behavior. Editor monospace, line numbers, syntax colouring, bracket indication, indent and unindent receive independent scores. Stale Save’s actual UI draft recovery is separate from server refusal; stale rename/delete each retain their own record and server-protection outcome. Stop on completed versus pending work remains separate because either can work without the other.',
'',
'These allocations are a design judgment, not a guarantee that a future platform rubric reviewer will accept every grouping. In particular, any policy demanding one row per mechanism or layer would require further splits; the present target is an independently useful user behavior, not one assertion or fixture variant.',
'',
'## Shared execution and actual work change',
'',
'The seven phases are: (1) workspace/editor/console; (2) save/load then immediate real restart then two-editor conflicts; (3) language dispatch/completed interactions/cancellation; (4) unsupported execution, literal loops, exact synchronous/async errors, shared deadlines; (5) Auto-run/import/export; (6) deferred example Save and shortcut Save plus remaining library rules; (7) dirty transitions/native leave then origin/privacy/network boundaries. The example and keyboard saved-copy legs are deferred; their authored data is recorded before the restart and deliberately re-entered later.',
'',
'The eleven removed baseline Runs are S03→S04 (1), S08→S09→S10→S11→S12→S13→S36 (6), S17→S33 (1), S16→S34 (1), and S05→S06→S07 (2). Each handoff uses an observed successful completed DOM/log state, never a previous verdict. Error rollback expects recorded `currentLastGood`, not a fixed marker whose Run was omitted. If no usable handoff exists, the receiving protocol performs one ordinary positive control, without changing the earlier outcome. Unsupported harmless-word HTML and the successful interaction-commit fixture remain specialized controls and cannot be replaced by generic recovery.',
'',
'S16 performs its existing three Runs; the third also creates a visible DOM marker. S34 switches themes before S16 clears logs, so state preservation has nonempty preview and console evidence without a new Run. S31 reloads S30’s freshly verified clean saved Base, or creates its own fallback if unavailable. Saved-record negative scenarios continue to own distinct records and refresh actual revisions between independent attempts. The larger all-actions estimate is intentionally **unmeasured**; legacy per-protocol planning figures are not summed into a claimed current total. New coverage and failure fallbacks offset part of the setup saving.',
'',
'The mandatory absence/deadline windows are preserved. This proposal does not promise checkpointing, recovery of partial schema output after timeout, provider-cost reduction, guaranteed completion, or successful platform grading. A larger number of final verdicts still increases output overhead; only short evidence sentences are requested, with no second narrative/ledger.',
'',
'## Public coverage limits',
'',
'| Public feature | Directly observed coverage | Remaining limit |',
'| --- | --- | --- |',
'| Server never evaluates source on save/import/export | Browser transfer/persistence and lack of browser auto-execution are observed. | No direct server-execution instrumentation exists; browser results do not prove absence of invisible server evaluation. Implementation-source inspection remains banned. |',
'| TypeScript/React/Vite, Express/SQLite, runtime packaging and one process | Launch, public server data and actual process-restart durability are observable elsewhere in the task. | Browser-only Functional cannot prove technology choice, no startup package installs, absence of an external service, or independence from removed build-time assets. Do not claim those are proven by this map. |',
'| Shared five-second budget for source functions and Promise callbacks | Braced/unbraced literal loops, delayed timer loop, and pending interaction timer are directly timed. | Recursion, a Promise callback consuming the remaining Run/interaction budget, and arbitrary supported callback combinations are not directly timed. Promise rejection reporting is not Promise-budget proof. |',
'| CSS copies document/styles without globals/timers/handlers | Prior document and style survive; proven script and handler do not rerun; later JS is fresh. | CSS-specific inherited globals and pending timers are not separately observed. Fresh JS does not prove CSS-global isolation. |',
'| All errors map to entered lines and restore good preview | Exact JS synchronous, HTML synchronous, JS timer and JS Promise fixtures have independent diagnostic/line/rollback evidence. | HTML timer/Promise line mapping and ordinary throwing/rejecting interaction rollback are untested combinations. Timeout-after-successful-interaction is directly checked. |',
'| Preserve dirty work after stale save/rename/delete | A real stale Save editor retains its draft and deliberately recovers; rename/delete server protection is directly replayed. | Actual dirty-UI retention after stale rename/delete is not established by Save’s UI test. The server-only rows do not claim it. |',
'| Useful own examples, startup and fresh drafts | Useful startup, one chosen usable example, immutable template versus saved copy, and New identity/transition behavior are observed. | The suite does not require every example to execute or prescribe a language/example count. A deliberately broken teaching example is not automatically a defect. |',
'| Browser leave protection | Clean reload and dirty native reload dismissal/acceptance are tested after real interaction. | Navigation to another page is a representative untested leave variant; no exact browser dialog wording is required. |',
'| Import and extension handling | Lowercase supported import, uppercase .JS import/save, unsupported import, server extension/path rules, exact source/edit/save and no execution when off. | Import-triggered enabled Auto-run is not separately exercised; the public text permits its ordinary Auto-run handling, and S17 checks that rule independently. Unicode and newline encodings are untested data variants, not a newly imposed file-format policy. |',
'| Privacy/network/origin boundaries | Nine private-path representatives with public-role exceptions, separate controlled fetch/Image, and four parent document/storage operations. | No exhaustive absence-of-leaks/escapes/network-channel guarantee. Other filenames and mechanisms remain under the broad public requirement, not an untested permission. |',
'| Theme, narrow screens, legibility, keyboard accessibility | Functional owns switching/preservation and named shortcuts/editor behavior. | Visual/Polish retain their existing separate checks; this Functional decomposition is not their replacement. |',
'',
'The directly added observations close concrete old omissions without adding public requirements: manual Run with Auto-run on is tested after the enabled debounce settles and without another edit; original-to-copy mutation is tested in addition to copy-to-original; source-only dirty state is observed independently; prior HTML-authored style is checked after CSS. No queued-auto cancellation by manual Run is demanded.',
'',
'## Concrete partial/valid implementation witnesses',
'',
'| Witness | Expected independent result |',
'| --- | --- |',
'| Imports exact supported source but accepts a bad saved filename on the server. | Import transfer/edit/save can pass; the relevant server filename policy fails. Use saved control if importer itself fails. |',
'| Trims names and rejects duplicates but treats Sketch and sketch as identical. | Normalization and collision protection retain evidence; case-sensitive coexistence fails. |',
'| Correct language dispatch/CSS appearance but copied CSS document keeps a live old handler. | Dispatch and CSS styling can pass; CSS execution-state isolation fails after the proven handler control. |',
'| Error message appears correctly but points at an injected wrapper line; rollback works. | Message and rollback can pass, exact source line fails. |',
'| Tab indents correctly but collapses selection. | Indent passes; reselect before independently testing Shift+Tab. Selection retention is not public. |',
'| UI proactively disables stale Save with useful feedback and keeps dirty fields. | UI conflict recovery can pass; use captured valid stale request shape to establish server refusal separately. |',
'| Transactional renderer hides candidate DOM and disables second input while work is pending. | Deadline and latest-commit rollback can pass from actual start/log/time/final-state observations; never force disabled controls. |',
'| Working public browser asset is named /server.js. | The established intended role is valid; filename alone cannot trigger a private-file failure. A directory server denying only the former three paths still fails on observed other representative leaks. |',
'',
'## Binding and static validation',
'',
]
for key in ('source_judge_sha256','draft_judge_sha256','draft_prompt_sha256','draft_context_sha256'):
    lines.append(f'- `{key}`: `{validation[key]}`')
lines += ['', 'Static validation parses TOML, checks 88 unique positive binary rows/evidence keys, conserves all 37 original weights with Decimal and the exact 49.5 total, preserves judge/MCP/scoring configuration, rejects obsolete fixed baseline names, and confirms the context no longer demands per-child fixtures. No browser or provider result is invented by this report. The independent harness owns its installed-builder/argv and runtime observations.', '', 'The context delta is already present in the parent-authored review draft: Functional owns distinct **scenario** fixtures, sibling outcomes share actual evidence without inheriting verdicts, invalidated records/revisions are refreshed, and the restart is early after basic save/load. It also replaces the obsolete `auto_run` criterion-name reference with the general Auto-run feature. All other dimensions, folder layout, launch profiles and budgets remain unchanged.', '']
(out / 'INDEPENDENCE_REVIEW.md').write_text('\n'.join(lines), encoding='utf-8')
witnesses = dict((p[0], p[1:]) for p in (line.split('|', 2) for line in (out / 'partial-witnesses.txt').read_text(encoding='utf-8').splitlines() if line.strip()))
actual_keys = {c['evidence_key'].split('.', 1)[1] for r in mapping['mapping'] for c in r['atomic_outcomes']}
assert set(witnesses) == actual_keys, (set(witnesses) - actual_keys, actual_keys - set(witnesses))
judge_lines = (draft/'judge.toml').read_text(encoding='utf-8').splitlines()
prompt_lines = prompt.splitlines()
inventory = [
'# 88-outcome counterexample and valid-alternative review', '',
'This is a static semantic witness inventory for every frozen binary outcome. The wrong implementations are concrete thought experiments, not executed mutants or claimed browser results. Each is sufficient to distinguish the owned behavior from setup or another useful feature. The valid-handling column records why a plausible implementation must not be failed for a hidden UI, timing or naming requirement. Some rows own a coherent policy with representative variants; this is not one reward for every assertion.', '',
'Read with `INDEPENDENCE_REVIEW.md`, whose 37-row map supplies every original Decimal budget and public requirement, and whose coverage ledger names requirements/combinations not directly observed. No “all QC pass” or platform acceptance guarantee is claimed. Harness schema fixtures validate integration, not the correctness of every product verdict.', '',
f"Frozen file-byte hashes: judge `{validation['draft_judge_sha256']}`; prompt `{validation['draft_prompt_sha256']}`; context `{validation['draft_context_sha256']}`.", '',
'| Outcome and draft source line | Public requirement | Concrete wrong/partial implementation witness | Valid alternative / evidence isolation |',
'| --- | --- | --- | --- |',
]
for row in mapping['mapping']:
    for child in row['atomic_outcomes']:
        key = child['evidence_key'].split('.',1)[1]
        line_number = next(i + 1 for i,line in enumerate(judge_lines) if line == 'id = ' + json.dumps(child['id']))
        wrong, valid = witnesses[key]
        inventory.append(f"| `{child['evidence_key']}` ([judge:{line_number}](draft/judge.toml#L{line_number})) | {row['public_requirements']} | {wrong} | {valid} |")
inventory += ['', 'All 88 keys occur exactly once above and exactly once in the scored rubric. Shared control facts have no extra row. The twelve error facts, four Auto-run facts, six import facts, five title facts and six editor facts are explicit partial-credit boundaries; a protocol is never graded as one conjunction. Intrinsic positive controls, rejection nonmutation and ordinary recovery remain inside the related useful outcome. The stopped-completed and stopped-pending lifecycles use distinct actual execution states.', '', 'Residual interpretation risk: platform review may define “independent” more narrowly than useful feature/policy. Remaining representative groupings include JS/HTML filename dispatch, case acceptance across supported forms, CSS script/handler exclusion, warning/cancel variants across replacement routes, ordered console level delivery, and UI/server enforcement of one title-uniqueness invariant. Those groupings are named rather than hidden. Splitting each mechanism/variant would increase row count again without eliminating the need for the same bounded browser observations. The current proposal follows the parent-reviewed compact feature level, not the previously overbroad all-flow rule.', '']
(out / 'OUTCOME_COUNTEREXAMPLES.md').write_text('\n'.join(inventory), encoding='utf-8')
validation['all_outcomes_have_static_counterexample_and_valid_handling'] = len(witnesses)
(out / 'draft-validation.json').write_text(json.dumps(validation, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'report': str(out / 'INDEPENDENCE_REVIEW.md'), 'rows': mapping['atomic_count'], 'weight': mapping['total_weight'], 'frozen_draft_unchanged': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (out/'draft').iterdir() if p.name in ('judge.toml','prompt.md','app_context.md')}}, indent=2))

"""Read current/baseline task instructions and write this audit directory only."""
from pathlib import Path
from decimal import Decimal
import hashlib
import json
import tomllib

out = Path(__file__).resolve().parent
root = out.parents[3]
task = root / 'projects/colderwater-playground-devtools'
review = out.parent
old = root / 'deliverables/colderwater-playground-devtools/structural-review-2026-09-27/semantics/draft'
paths = {'judge': 'tests/scored/functional/judge.toml', 'prompt': 'tests/scored/functional/prompt.md', 'context': 'tests/app_context.md'}
data = {k: (task/v).read_bytes() for k,v in paths.items()}
before = {k: (old/({'judge':'judge.toml','prompt':'prompt.md','context':'app_context.md'}[k])).read_bytes() for k in paths}
assert {k:hashlib.sha256(v).hexdigest() for k,v in before.items()} == {
    'judge':'fddbccfa88e68a90c9bdb8d9328c48c42baace7210f1c26bdb3d468aec79a331',
    'prompt':'598f43d7972b19f63fc3906c8d45278123a5db17c4c4576a81ace93207f5ceb3',
    'context':'4d0cd1d8d2ffd8690822e20ba395e7d153dd09e999016d9f0aa84cfce405e732'}
j = tomllib.loads(data['judge'].decode('utf-8'))
o = tomllib.loads(before['judge'].decode('utf-8'))
prompt = data['prompt'].decode('utf-8')
context = data['context'].decode('utf-8')
ledger = dict(line.split('|',1) for line in (out/'control-ledger.txt').read_text(encoding='utf-8').splitlines() if line)
old_rows = {c['id']:c for c in o['criterion']}
new_rows = {c['id']:c for c in j['criterion']}
assert len(old_rows) == len(new_rows) == 88
assert old_rows.keys() == new_rows.keys()
assert j['judge'] == o['judge'] and j['scoring'] == o['scoring']
assert sum(Decimal(str(c['weight'])) for c in j['criterion']) == Decimal('49.5')
for cid,c in new_rows.items():
    assert c['type'] == old_rows[cid]['type'] == 'binary'
    assert Decimal(str(c['weight'])) == Decimal(str(old_rows[cid]['weight']))
assert set(ledger) == {c['description'].split(':',1)[0].split('.',1)[1] for c in j['criterion']}
assert 'only each short outcome defines its pass boundary' not in prompt
assert 'Judge its named outcome together with the successful controls needed' in prompt
assert 'after an actual Stop remains valid' in prompt
assert 'S02\'s post-CSS absence of oldGlobal alone is not a global-freshness control' in prompt
assert 'If the harmless-word control is refused' in prompt
assert 'If the HTML mode still fails' in prompt
assert 'It is a terminal classification' in prompt
assert 'concrete affirmative evidence' in prompt
assert 'Only that explicitly unresolved branch uses EVALUATION_INCOMPLETE' in context
manifest = json.loads((review/'review-candidate/candidate_manifest.json').read_text(encoding='utf-8'))
archive = review/'review-candidate'/manifest['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
current_hashes = {k:hashlib.sha256(v).hexdigest() for k,v in data.items()}
for key,path in paths.items():
    assert current_hashes[key] == manifest['source_sha256'][path], (key, 'source/archive binding changed; rerun after freeze')
    assert (task/path).read_bytes() == data[key], 'source changed during read'
changed = [cid for cid,c in new_rows.items() if c['description'] != old_rows[cid]['description']]
judge_lines = data['judge'].decode('utf-8').splitlines()
prompt_lines = prompt.splitlines()
matrix = []
for c in j['criterion']:
    evidence = c['description'].split(':',1)[0]
    scene,key = evidence.split('.',1)
    pline = next(i+1 for i,line in enumerate(prompt_lines) if line.startswith('### '+scene+' '))
    jline = next(i+1 for i,line in enumerate(judge_lines) if line == 'id = '+json.dumps(c['id']))
    disposition = 'Explicit descriptor repair plus mandatory protocol controls' if c['id'] in changed else 'Existing outcome retained; its relevant protocol controls are mandatory'
    if key == 'working_files_private': disposition = 'Exclusive ordered privacy decisions plus named evidence-limitation exception'
    if key in ('css_apply_snapshot','unsupported_execution_refused'): disposition += '; conditional control fallback preserves independent evidence'
    matrix.append({'id':c['id'], 'evidence_key':evidence, 'weight':str(c['weight']), 'description':c['description'], 'judge_line':jline, 'protocol_line':pline, 'disposition':disposition, 'required_actual_controls':ledger[key]})
binding = {
    'audit_type':'Static independent semantics/control audit; not a model or browser execution',
    'archive_sha256':manifest['sha256'],
    'source_file_sha256':{paths[k]:current_hashes[k] for k in paths},
    'before_release_file_sha256':{k:hashlib.sha256(v).hexdigest() for k,v in before.items()},
    'criteria_audited':88, 'weight_decimal':'49.5', 'all_ids_types_weights_unchanged':True,
    'judge_mcp_scoring_config_unchanged':True, 'changed_descriptors':changed,
    'shared_meaningful_controls_explicit':True,
    's02_js_control_fallback':'Present; semantically reviewed; not executed by this audit',
    's08_plain_control_fallback':'Present; semantically reviewed; not executed by this audit',
    'privacy_decision_precedence':'Accepted denial/no-content/working fallback -> established public role -> concrete unresolved ordinary-use role after one clarification -> exposure; tool failures separate',
    'limitations':['No paid/model/platform calls', 'No browser execution by this semantics audit', 'Conditional fallback paths are not runtime-proven here', 'No exhaustive absence-of-leaks guarantee', 'No guarantee a platform judge will obey the evidence rules or accept the rubric'],
    'matrix':matrix,
}
(out/'control_audit.json').write_text(json.dumps(binding, indent=2)+'\n', encoding='utf-8')
lines = [
'# Independent audit of all 88 positive-control boundaries', '',
f"Audited candidate ZIP SHA256: `{manifest['sha256']}`. This report covers all **88 Functional outcomes** and their 37 protocols, shared context and public behavior scope. All IDs, binary types, weights and the **49.5** total remain unchanged; judge/MCP/scoring configuration is unchanged. This is a source-level semantic audit, not a full Oracle run or an all-QC-pass statement.", '',
'## Findings and final disposition', '',
'1. **Confirmed systemic cause, corrected:** the earlier prompt said only each short outcome defined its pass boundary. That allowed procedural controls to be treated as optional when independent child rows were scored. The revised common contract makes the relevant successful protocol controls part of each named result while explicitly forbidding inheritance of a sibling verdict. It requires actual execution, accepted operations, populated state and real targets before absence or preservation can earn credit.', '',
'2. **Confirmed screenshot witnesses, corrected:** an app whose Auto-run never executes could previously earn the off-state score from silence; both idle-off and queued-off now require actual enabled execution/timing and runnable code. A CSS implementation deleting or hiding the whole preview could previously keep both old marker counts constant; CSS inertness now requires the proven pre-CSS script/handler plus the actual copied document, available authored button and completed normal click. These controls consume existing scenario observations, not new weighted features.', '',
'3. **Additional same-class omissions, corrected:** imported nonexecution now requires an actual import and later execution of that same source; unsupported import requires an accepted supported-file control. Collision/empty-title and extension/path refusal consume real valid writes and existing valid recovery. Console history requires actual newly appended markers. Copy independence requires each own edit to persist. The shared callback deadline requires the actual delayed-callback entry marker. Completed Stop requires a previously functioning handler. Theme-state preservation now expressly names actual theme changes; this last item clarifies an existing operation requirement rather than adding a new feature.', '',
'4. **A genuine protocol control gap, corrected:** absence of `oldGlobal` after CSS could not by itself prove fresh JavaScript globals, because CSS must already discard those globals. Freshness now consumes existing S04 facts: A actually executes its unconditional setter before its start log, then B actually renders the undefined result and logs its own start. A failed cancellation timing result does not erase those separately observed facts, and no extra nominal Run is added.', '',
'5. **Independent fallback requirements, corrected:** if the harmless-word control is refused, ordinary supported DOM/log source can establish a last-good baseline for unsupported-family refusal without awarding harmless-word credit. If HTML dispatch cannot establish the CSS baseline, the equivalent ordinary JS-authored heading/style/button and live handler can establish CSS controls without awarding HTML dispatch. These paths are conditional fallbacks, not new successful-path actions; they were semantically reviewed but are not runtime-proven by this audit.', '',
'6. **Privacy classification overlap, corrected:** S06 now uses ordered terminal decisions. Established denial/no-content/workspace fallback wins first, including denial over an attachment event; an established ordinary-use public role is accepted. Only concrete affirmative ordinary-use evidence of a public purpose, still unresolved after one bounded clarification, enters the explicitly named permitted-observation limitation. That branch cannot also be exposure. A bare 200, suggestive filename, app claim, probe-created request or no role evidence cannot invoke it. Remaining successful standalone delivery is ordinary exposure/no, not EVALUATION_INCOMPLETE. Shared context now explicitly describes the narrow exception, so its tool-failure rule no longer contradicts S06.', '',
'7. **Valid alternatives retained:** a preview may hide pending candidate DOM; pending input may be ignored/blocked; rollback may be static; completed Stop may remove/disable its previously live controls. The new common rule expressly distinguishes a never-working control from a legitimately removed post-Stop control. Public assets can use candidate filenames; observed roles, working fallback, no-content and denial remain accepted. Source/body/database inspection stays banned. Supported lowercase controls isolate uppercase failures; proactive stale-Save prevention remains valid; controls and routes remain app-defined.', '',
'## Independence constraints on controls', '',
'A successful control is an observed fact, not a request for another outcome to pass. One enabled automatic execution is sufficient to make off-state testing meaningful even if debounce reset is defective. An accepted supported import need not pass the full exact-transfer/edit/save result before unsupported-extension refusal can be observed. A successful valid title operation need not prove trimming, case sensitivity or every rename invariant. A previously functioning click handler can establish a live completed context even when another keyboard feature fails. A real visible theme change need not establish perfect theme coverage of every component before state preservation is observable.', '',
'For preservation and cancellation outcomes, the target action must actually occur: a successful earlier render, a real later failure/Stop, an actually changed pane allocation, a real saved edit, a populated console, or a working replacement/deletion route as appropriate. The descriptor does not receive every sibling success as a prerequisite. The ledger below states the controls relevant to each individual row; it is not a conjunction of every fact from its whole protocol.', '',
'The retained controls for normal deletion cancellation and dirty-transition cancellation include the corresponding real accepted operation from the same existing protocol. A decorative confirmation or a route that never replaces anything cannot prove protective cancellation. That does not require the entire selected-only deletion or full accepted-transition sibling verdict to pass. Likewise, actual timeout/error triggers are needed before rollback can be observed, but exact diagnostic wording, line accuracy or the whole deadline result are independently owned.', '',
'## Complete 88-row control audit', '',
'Every row was read against its full protocol. “Retained” means no extra descriptor edit was justified after making the relevant protocol controls binding; it is not an unexecuted product pass. Line references point into the byte-bound candidate.', '',
'| Outcome | Disposition | Mandatory observed controls / independence boundary |',
'| --- | --- | --- |',
]
for r in matrix:
    lines.append(f"| `{r['evidence_key']}` (judge:{r['judge_line']}; prompt:{r['protocol_line']}) | {r['disposition']} | {r['required_actual_controls']} |")
lines += ['', '## Limits and evidence binding', '',
'This audit made no paid/provider/model/platform calls and did not execute browser flows. It checks that the final instructions require the evidence and classify it consistently; it cannot prove that a future judge will gather or honor every control. The conditional HTML-to-JS CSS control and harmless-word-to-plain-source control have not been exercised by this audit. Existing timing windows, nine privacy paths, five unsupported families, separate network probes, one restart and nominal action ordering remain; no measured total runtime or cost is claimed.', '',
'Privacy cases are bounded behavioral observations. They cannot establish that every internal filename is private or rule out every disclosure mechanism, and a legitimate intended public role may sometimes remain unresolved under the source-inspection ban. The exception requires positive ordinary-use evidence and a bounded clarification, so uninformative delivery cannot be reclassified as evaluator failure. No additional source inspection or hidden public filename restriction is introduced.', '',
'The former `harbor-webdev-rubric-qc/SKILL.md:64` whole-flow allowance is not treated as permission to drop controls from independent outcomes or combine unrelated rewards. The actual platform feedback controls this repair: keep separate useful outcome ownership and retain each outcome’s meaningful setup facts. Source inspection, schema construction, local controls and a prior golden result do not establish a complete successful platform evaluation.', '',
f"Before-release judge: `{hashlib.sha256(before['judge']).hexdigest()}`; prompt: `{hashlib.sha256(before['prompt']).hexdigest()}`; context: `{hashlib.sha256(before['context']).hexdigest()}`.", '',
f"Current judge: `{current_hashes['judge']}`; prompt: `{current_hashes['prompt']}`; context: `{current_hashes['context']}`.", '',
'`control_audit.json` contains all row-level dispositions and exact hashes. `proposed-replacements.json` preserves the narrow repair proposals. Previous frozen deliverables were only read; this subtask writes solely within this new semantics directory. The parent owns task edits, archive packaging and runtime validation.', '']
(out/'POSITIVE_CONTROL_AUDIT.md').write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps({'report':str(out/'POSITIVE_CONTROL_AUDIT.md'), 'archive_sha256':manifest['sha256'], 'criteria':len(matrix), 'weight':'49.5', 'changed_descriptors':len(changed), 'source_file_sha256':binding['source_file_sha256']}, indent=2))

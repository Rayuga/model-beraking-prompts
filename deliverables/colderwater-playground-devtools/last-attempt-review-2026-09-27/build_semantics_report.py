from pathlib import Path
import hashlib
import json
import re
import tomllib
import zipfile
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'deliverables/colderwater-playground-devtools/positive-controls-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip'
EXPECTED = '663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e'
archive_hash = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
assert archive_hash == EXPECTED
prefix = 'colderwater-playground-devtools/'
with zipfile.ZipFile(ARCHIVE) as archive:
    files = {n[len(prefix):]: archive.read(n) for n in archive.namelist() if n.startswith(prefix) and not n.endswith('/')}

def txt(name):
    return files[name].decode('utf-8')

functional = 'tests/scored/functional/judge.toml'
prompt = 'tests/scored/functional/prompt.md'
criteria = tomllib.loads(txt(functional))['criterion']
assert len(criteria) == 88
weights = [Decimal(str(c['weight'])) for c in criteria]
assert sum(weights) == Decimal('49.50')

findings = [
    {
        'id': 'C1', 'severity': 'P1', 'classification': 'material coverage defect', 'confidence': 'high', 'qc': [26],
        'title': 'CSS global-state exclusion has no observation during the CSS run',
        'public': ['environment/instructions/behaviour.md:5'],
        'rubric': [functional + ':57', functional + ':71', functional + ':78', prompt + ':135', prompt + ':140', prompt + ':142', prompt + ':148', prompt + ':179'],
        'requirement': 'CSS must use a fresh isolated copy and must not carry old globals, timers or event handlers.',
        'observed_probe': 'S02 installs window.oldGlobal, observes old script and click-handler markers, then checks retained CSS DOM/style and absence of those markers. It reads typeof oldGlobal only in the later JavaScript Run. S04 separately proves JavaScript global freshness.',
        'wrong_implementation_witness': 'For CSS only, reuse the old Window, replace its document with an inert DOM clone, remove old listeners and apply the new CSS without rerunning scripts, but leave window.oldGlobal intact. Use a fresh Window for each later JavaScript Run. CSS content/style, script and handler checks pass; the later fresh-undefined and S04 checks pass. The CSS run nonetheless carried an old global.',
        'why_material': 'Globals are an explicitly named excluded state category, wholly unobserved in the CSS phase. This is not merely another spelling of a tested input or an exhaustive-security demand.',
        'valid_alternative_impact': 'No particular iframe, cloning library or sandbox architecture should be required. Observe only the authored global being present before and absent during the CSS result. A fresh context or another mechanism giving the same observable isolation is valid.',
        'repair_direction_only': 'A future revision could observe the authored global in the preview before and immediately after CSS, before replacing it with JavaScript. Keep this browser-state observation separate from implementation-source inspection. No repair was applied in this review.',
        'runtime_status': 'Logical counterexample only; no mutant or provider execution in this review.'
    },
    {
        'id': 'C2', 'severity': 'P1', 'classification': 'material coverage defect', 'confidence': 'high', 'qc': [26],
        'title': 'Stale Rename/Delete do not test retention of the actual dirty editor',
        'public': ['environment/instructions/behaviour.md:31'],
        'rubric': [functional + ':407', functional + ':449', functional + ':491', prompt + ':397', prompt + ':399', prompt + ':419', prompt + ':422', prompt + ':446', prompt + ':448', prompt + ':449', 'tests/app_context.md:12'],
        'requirement': 'Saving, renaming or deleting uses the loaded revision; refuse stale operations and keep unsaved work so the user can compare, reload and deliberately reapply it.',
        'observed_probe': 'S23 uses two real dirty editors for stale Save. S25 permits a captured old request and expressly limits its ownership to the saved-state invariant. S28 replays an old-revision delete. Neither creates and checks a dirty second editor through the Rename/Delete conflict UI.',
        'wrong_implementation_witness': 'The server correctly rejects all stale writes and preserves fields/revisions. The Save conflict handler retains the dirty draft. Rename and Delete conflict handlers automatically reload the latest saved record, dropping unsaved title/filename/source. All specified stale-server and Save-draft probes can pass while Rename/Delete discard work.',
        'why_material': 'The public paragraph names three user operations and then promises unsaved-work retention. A server replay has no editor draft and cannot establish that promise for distinct UI handlers. S30 replacement warnings do not exercise conflict handling.',
        'valid_alternative_impact': 'Both an actual rejected UI request and proactive stale-conflict prevention remain valid if they explain the conflict and preserve the draft. Do not force disabled controls or require a particular conflict dialog.',
        'repair_direction_only': 'A future revision should obtain live dirty-editor evidence for each operation while retaining separate server-refusal evidence. No task changes made.',
        'runtime_status': 'Logical counterexample only; no mutant or provider execution in this review.'
    },
    {
        'id': 'C3', 'severity': 'P1', 'classification': 'material coverage defect', 'confidence': 'high', 'qc': [26],
        'title': 'HTML and CSS supported-file import are never exercised',
        'public': ['instruction.md:1', 'environment/instructions/behaviour.md:27', 'environment/instructions/behaviour.md:37'],
        'rubric': [functional + ':540', functional + ':575', prompt + ':467', prompt + ':493', prompt + ':497', prompt + ':501'],
        'requirement': 'Supported source filenames are .js, .html and .css, case-insensitively; import brings a supported file filename and exact text into an editable draft that can be saved.',
        'observed_probe': 'The dirty-import probe uses cw-dirty-import.js. S33 imports import-me.js and import-me.JS, then refuses notes.txt. No HTML or CSS file is imported. Language execution and editor highlighting are separate paths.',
        'wrong_implementation_witness': 'An otherwise correct importer accepts only .js (case-insensitively) and refuses .html/.css. Manual HTML/CSS editor execution and all other product features work. Every guaranteed import fixture succeeds or refuses as expected.',
        'why_material': 'Two members of the brief\'s explicit three-language supported-file set are entirely absent from import observations. Executing HTML/CSS entered manually does not prove importing them.',
        'valid_alternative_impact': 'Any normal browser-file UI and exact-text representation are valid. Test support, not a prescribed input accept attribute, route or editor package.',
        'repair_direction_only': 'A future bounded shared import scenario could include each supported source language without repeating every rejection, timeout or persistence test.',
        'runtime_status': 'Logical counterexample only; no mutant or provider execution in this review.'
    },
    {
        'id': 'N1', 'severity': 'P2', 'classification': 'remaining independence interpretation risk', 'confidence': 'medium', 'qc': [28],
        'title': 'Uppercase import acceptance and uppercase server-save acceptance still share one binary row',
        'public': ['environment/instructions/behaviour.md:27', 'environment/instructions/behaviour.md:37'],
        'rubric': [functional + ':575', prompt + ':501'],
        'detail': 'cw_source_file_extension_case awards one 0.20 result for uppercase .JS import AND save. The protocol itself separately isolates those layers and explicitly recovers if either fails. An importer-only uppercase bug and a server-only uppercase bug lose the same entire row despite the other layer working. This resembles the earlier platform demand for separate useful outcomes, but the exact granularity for one cross-layer case-insensitivity rule is interpretive. It is a risk, not an additional demonstrated platform rejection or the reason Hold is already necessary.',
        'runtime_status': 'Source interpretation only.'
    },
    {
        'id': 'N2', 'severity': 'P2', 'classification': 'coverage and permitted-observation design limitation', 'confidence': 'high', 'qc': [26, 32],
        'title': 'Invisible backend evaluation and named internal technologies are not established by browser evidence',
        'public': ['environment/instructions/behaviour.md:39', 'environment/instructions/security.md:11', 'environment/instructions/integration.md:3', 'environment/instructions/integration.md:11'],
        'rubric': ['tests/gates/constraints/judge.toml:29', 'tests/gates/constraints/prompt.md:6', prompt + ':7'],
        'detail': 'The constraint gate expressly proves basic shared server read/write, not SQLite or Express. A backend that evaluates source and discards every effect can be browser-indistinguishable from one that never evaluates it. Source/database inspection is prohibited. This is a contract-versus-observability design limit, not a demand to enumerate all attacks and not an observed backend execution. It must not be represented as fully proved. C1-C3 are observable coverage defects and independently justify Hold.',
        'runtime_status': 'Indistinguishability argument only; no backend inspection or execution.'
    }
]

qc = [
    {'number': 26, 'verdict': 'Fail', 'severity': 'P1', 'evidence': ['C1', 'C2', 'C3'], 'reason': 'Asked observable behaviours can be wrong while all current guaranteed observations pass. Prior caveat-only treatment did not satisfy this coverage check.'},
    {'number': 27, 'verdict': 'Pass', 'scope': 'static review only', 'reason': 'No new concrete unrequired-obligation counterexample found. Current wording allows provisional-preview hiding, blocked pending input, static rollback, proactive conflict prevention, arbitrary labels/layout and genuine public-asset filename overlap.'},
    {'number': 28, 'verdict': 'Note', 'severity': 'P2', 'evidence': ['N1'], 'reason': 'The 88-outcome decomposition and fact-sharing contract materially reduce the earlier bundles. One remaining cross-layer case-acceptance row warrants scrutiny under the platform interpretation; no additional incompatible-product bar found.'},
    {'number': 29, 'verdict': 'Pass', 'scope': 'static review only', 'reason': 'Render requires authored DOM/log output; Constraints requires new server write and independent clean-context retrieval. All three scored prompts restate usable/server-backed gate and zero their dimension after observed product-gate failure, while preserving external assets and no-auth contract.'},
    {'number': 30, 'verdict': 'Pass', 'scope': 'static review only', 'reason': 'Read all 88 descriptions against the actual shared mandatory-control contract and protocols. Enabled Auto-run and retained clickable CSS control are explicit; the final HTML-to-JS CSS fallback matches the descriptor. No additional concrete vacuous-pass control omission found. This does not cure unprobed required behaviours in #26.'},
    {'number': 31, 'verdict': 'Pass', 'scope': 'defined observed collections; static review only', 'reason': 'Specified multi-operation collections are enumerated: nine privacy candidates, four parent accesses, five unsupported families, four dirty transitions and complete relevant library lists. No additional concrete within-probe collection omission found. The omitted supported import categories are reported under #26, not concealed by this scoped result.'},
    {'number': 32, 'verdict': 'Note', 'severity': 'P2', 'evidence': ['N2'], 'reason': 'The scored protocols ask for browser-visible facts and product-data evidence, not implementation reads. S06 explicitly represents its narrow unresolved-public-role observation as incomplete. That bounded design cannot establish every private file or invisible backend/internal-stack requirement.'},
    {'number': 33, 'verdict': 'Pass', 'scope': 'static review only', 'reason': 'Current S06 terminal ordering no longer calls the same response both exposure and incomplete. Accepted denial/public role, narrowly unresolved affirmative role evidence, and ordinary no-role exposure are mutually exclusive in the text. No other concrete conflicting full-credit bar found.'}
]

scenario_refs = {
 'S01': ['overview.md:3', 'overview.md:9'],
 'S02': ['overview.md:5', 'behaviour.md:5'], 'S03': ['behaviour.md:11', 'security.md:3'],
 'S04': ['behaviour.md:7', 'behaviour.md:13'], 'S05': ['security.md:3'], 'S06': ['security.md:11'],
 'S07': ['security.md:9'], 'S08': ['security.md:7'], 'S09': ['behaviour.md:9', 'behaviour.md:13'],
 'S10': ['behaviour.md:13', 'behaviour.md:15'], 'S11': ['behaviour.md:13', 'behaviour.md:15'],
 'S12': ['behaviour.md:13', 'behaviour.md:15'], 'S13': ['behaviour.md:13', 'behaviour.md:15'],
 'S14': ['behaviour.md:19'], 'S15': ['behaviour.md:19'], 'S16': ['behaviour.md:19'],
 'S17': ['behaviour.md:21'], 'S18': ['ui.md:3'], 'S19': ['ui.md:5'], 'S20': ['ui.md:5'],
 'S21': ['behaviour.md:25', 'integration.md:7'], 'S22': ['integration.md:7'], 'S23': ['behaviour.md:31'],
 'S24': ['behaviour.md:27', 'behaviour.md:29'], 'S25': ['behaviour.md:31'], 'S26': ['behaviour.md:29'],
 'S27': ['behaviour.md:29'], 'S28': ['behaviour.md:31'], 'S29': ['behaviour.md:31'],
 'S30': ['behaviour.md:35'], 'S31': ['behaviour.md:35'], 'S32': ['behaviour.md:37'],
 'S33': ['behaviour.md:27', 'behaviour.md:37', 'behaviour.md:39'], 'S34': ['ui.md:9'],
 'S35': ['ui.md:7'], 'S36': ['behaviour.md:9', 'behaviour.md:13'], 'S37': ['behaviour.md:11', 'behaviour.md:13']
}
row_issues = {
 'cw_css_apply_snapshot': ['C1'], 'cw_css_inert_copy': ['C1'], 'cw_js_fresh_document': ['C1'],
 'cw_stale_save_draft_recovery': ['C2'], 'cw_stale_rename_refusal': ['C2'], 'cw_stale_delete_refusal': ['C2'],
 'cw_supported_file_import': ['C3'], 'cw_source_file_extension_case': ['C3', 'N1'],
 'cw_working_files_private': ['N2']
}
lines = txt(functional).splitlines()
ledger = []
for c in criteria:
    scenario = c['description'].split('.', 1)[0]
    assert scenario in scenario_refs
    line = next(i + 1 for i, line in enumerate(lines) if line == 'id = ' + json.dumps(c['id']))
    ledger.append({
      'id': c['id'], 'type': c['type'], 'weight': str(Decimal(str(c['weight']))),
      'criterion_ref': functional + ':' + str(line), 'scenario': scenario,
      'public_refs': ['environment/instructions/' + r for r in scenario_refs[scenario]],
      'description': c['description'],
      'review_disposition': 'Read with shared contract and scenario; see linked scope finding' if c['id'] in row_issues else 'Read with shared contract and scenario; no additional concrete defect identified',
      'finding_links': row_issues.get(c['id'], []), 'runtime_verdict': 'Not exercised in this review'
    })

read_files = ['instruction.md', 'tests/app_context.md'] + sorted(n for n in files if n.startswith('environment/instructions/')) + sorted(n for n in files if n.endswith(('/judge.toml', '/prompt.md')))
result = {
  'review': 'Independent final-attempt semantics cold review', 'date': '2026-09-27', 'recommendation': 'Hold',
  'archive': str(ARCHIVE.relative_to(ROOT)).replace('\\', '/'), 'archive_sha256': archive_hash,
  'archive_bytes': ARCHIVE.stat().st_size, 'functional_count': len(criteria), 'functional_weight': str(sum(weights)),
  'scope': 'All public instructions, all 88 Functional descriptions, complete Functional protocol, shared context and all dimension prompts/descriptors. QC 26-33. Read-only artifact review; no task edits, no provider calls, no runtime mutants.',
  'input_sha256': {name: hashlib.sha256(files[name]).hexdigest() for name in read_files},
  'findings': findings, 'qc_26_33': qc, 'all_88_row_ledger': ledger,
  'bounded_variants_not_promoted_to_proven_defects': [
    'Promise-callback budget/recursion forms and HTML asynchronous-error cross-products are not individually demonstrated by the literal-loop, timer-deadline and Promise-rejection fixtures. These are limits of the sampled programs, not evidence that every possible program needs its own criterion.',
    'CSS timers are not seeded and followed through a CSS switch. This is adjacent to C1, but the exact completed-versus-pending timer setup requires care; the primary C1 witness needs only the unobserved authored global.',
    'A guaranteed .css server-save control is absent if the chosen built-in example is JS/HTML. A selective CSS-save rejection is another finite-category coverage concern; C3 reports the clearer wholly absent HTML/CSS import path rather than multiplying every format cross-product.',
    'Nine privacy paths, fetch/Image requests, two loop forms and bounded native navigation are representative tests, not exhaustive disclosure/network/program proofs.'
  ],
  'privacy_reassessment': {
    'references': [prompt + ':202', prompt + ':203', prompt + ':204', 'tests/app_context.md:32'],
    'conclusion': 'No new concrete contradiction in the final ordered terminal tree.',
    'accepted': 'Established denial/no-content/working workspace, or a genuine intended public asset/data role established through ordinary working use.',
    'incomplete': 'Only concrete affirmative ordinary-use role evidence still unresolved after one bounded clarification, or evaluator tooling failure. No simultaneous exposure verdict.',
    'failure': 'Successful standalone delivery after accepted outcomes are excluded, with no qualifying affirmative unresolved-role evidence.',
    'limits': 'An arbitrary filename, HTTP 200, app claim or probe request does not establish a public role. Bodies remain unread. Mixed-use or incompletely observed public-role situations retain judgment/observation uncertainty; no exhaustive privacy guarantee follows.'
  },
  'history_assessment': 'Earlier versions had concrete bundles, missing matching controls and contradictory privacy branches. The frozen artifact contains specific repairs to those. Prior reviews also recorded CSS-state and dirty Rename/Delete gaps but treated them as caveats instead of #26 failures. That was review/classification error; changing versions and discovering known omissions does not demonstrate nondeterminism on identical inputs.',
  'certainty': 'No guarantee of the last platform attempt. Pinned versions, hashes and mechanical checks are reproducible evidence; semantic LLM judgment and browser timing can vary. This review did not repeat identical provider runs or measure a rejection rate. Known C1-C3 defects are sufficient for Hold regardless of that uncertainty.',
  'not_exercised': ['full Oracle/provider evaluation', 'full Functional runtime completion and timeout fit', 'runtime execution of the counterexample implementations', 'exhaustive security behaviour', 'every permitted UI implementation'],
  'no_changes_to_task_or_archive': True
}

md = f'''# Last-attempt semantic review

**Recommendation: Hold the final attempt. QC #26 fails on concrete coverage gaps.** The strongest is C1: CSS can retain an old global and still satisfy every required observation. C2 and C3 provide independent examples. This is a review of the rubric, not a finding that the reference app exhibits these bugs.

Bound archive: `{result['archive']}`  
SHA-256: `{archive_hash}`  
Functional inventory: **88 binary rows, aggregate weight {sum(weights)}**.

I cold-read the frozen public brief and all six notes, all 88 descriptions, the complete shared Functional protocol, context, and every dimension's prompt/descriptors. I used QC #26–33 and the platform's stricter independent-outcome interpretation. The older local skill's permission to bundle whole flows does not establish compliance with the platform's later feedback. No task/ZIP edits, provider calls, application-source inspection or runtime counterexample executions occurred. The companion JSON binds every reviewed task file and records all 88 row dispositions; none is an inherited runtime Pass.

## Material findings
'''
for f in findings[:3]:
    md += f"\n### {f['id']} — {f['title']} ({f['severity']}, {f['confidence']} confidence)\n\n"
    md += 'Public requirement: ' + ', '.join('`' + x + '`' for x in f['public']) + '. ' + f['requirement'] + '\n\n'
    md += 'Current observations: ' + f['observed_probe'] + '\n\n'
    md += '**False-pass witness:** ' + f['wrong_implementation_witness'] + '\n\n'
    md += f['why_material'] + '\n\n'
    md += 'Valid alternatives: ' + f['valid_alternative_impact'] + '\n\n'
    md += 'Frozen references: ' + ', '.join('`' + x + '`' for x in f['rubric']) + '.\n\n'
    md += f['runtime_status'] + '\n'

md += '''
## QC disposition

These are static task-design results, not provider-run passes.

| QC | Result | Reason |
|---|---|---|
'''
for item in qc:
    md += f"| {item['number']} | {item['verdict']} | {item['reason']} |\n"
md += '\n## Remaining interpretation and observability limits\n'
for f in findings[3:]:
    md += f"\n**{f['id']} — {f['title']} ({f['severity']}; {f['confidence']} confidence).** {f['detail']} References: " + ', '.join('`' + x + '`' for x in f['rubric']) + '.\n'
md += '''
The final S06 privacy tree is materially clearer than the rejected version. An established denial takes precedence over an attachment event; real ordinary-use public assets/data may be accepted despite a candidate name; concrete but unresolved affirmative public-role evidence uses the narrow incomplete branch; ordinary successful standalone delivery without such evidence is a product failure. Those are terminal alternatives. A filename, status or app assertion alone cannot manufacture the exception. I found no new concrete contradiction in that ordering. Because response bodies are prohibited and only nine paths are sampled, this is still bounded browser evidence, not a proof of all private-file safety.

Do not confuse C1–C3 with every conceivable variant. The fixtures sample literal loops, timer deadlines, Promise rejection, fetch/Image and native navigation. They do not establish every recursion/Promise/HTML-async cross-product. CSS timers are not seeded through a CSS switch either; the exact pending/completed setup deserves care, so C1 relies on the simpler decisive global witness. The import finding concerns whole missing members of an explicit three-language set. A guaranteed CSS server-save probe is also absent when the chosen example is JS/HTML; this remains a related finite-category concern rather than a separately inflated blocker.

## Prior failures and certainty

The current descriptions/protocols contain the targeted fixes for the former four large bundles, dead-Auto-run silence, missing live CSS button controls, hidden candidate previews, blocked pending input, latest-successful-interaction rollback, title trimming, completed-preview Stop, example separation, and the contradictory privacy classification. Those repairs are real source changes. The all-88 control review found no new concrete vacuous-pass omission after them. Positive controls, however, cannot prove a public behaviour that a scenario never observes.

Earlier structural notes already acknowledged missing CSS-state and dirty Rename/Delete observations. Treating asked-but-ungraded behaviour as a coverage caveat instead of failing QC #26 was a review error. The previous generous whole-flow independence interpretation was also too broad for the platform's reported policy. Repeated rejections of changed candidates and discovery of missed defects do not, by themselves, show nondeterministic QC on identical input.

Pinned dependencies, exact byte hashes and mechanical checks can be reproduced. LLM semantic judgment and browser timing can still vary; no identical-input repeat experiment or rejection probability was measured here. Full provider execution, complete-runtime fit and these counterexample implementations remain unexercised by this review. There is no sound last-try guarantee. The known observable coverage defects justify Hold without relying on speculative nondeterminism.
'''
(OUT / 'semantics.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(OUT / 'semantics.md').write_text(md, encoding='utf-8')
print(json.dumps({'report': str(OUT / 'semantics.md'), 'json': str(OUT / 'semantics.json'), 'archive_sha256': archive_hash, 'criteria': len(criteria), 'weight': str(sum(weights)), 'recommendation': 'Hold', 'qc26': 'Fail', 'files_written': ['semantics.md', 'semantics.json']}, indent=2))

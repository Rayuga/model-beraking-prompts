from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
GOLDEN = OUT.parent / 'golden'
review = json.loads((OUT / 'semantic_review.json').read_text(encoding='utf-8'))
paths = {
  'golden': GOLDEN / 'run-golden-20260927-181640/browser-results.json',
  'css-live-context-leaks': GOLDEN / 'run-css-live-context-leaks-20260927-181641/browser-results.json',
  'conflict-ui-clears': GOLDEN / 'run-conflict-ui-clears-20260927-181641/browser-results.json',
  'js-only-importer': GOLDEN / 'run-js-only-importer-20260927-181642/browser-results.json'
}
data = {key: json.loads(path.read_text(encoding='utf-8')) for key, path in paths.items()}
freeze_path = GOLDEN / 'frozen_final_release_inputs.json'
freeze = json.loads(freeze_path.read_text(encoding='utf-8'))
assert freeze['freeze_confirmed'] is True
assert freeze['functional_sha256'] == review['source_hashes']['tests/scored/functional/judge.toml']
assert freeze['prompt_sha256'] == review['source_hashes']['tests/scored/functional/prompt.md']
assert freeze['context_sha256'] == review['source_hashes']['tests/app_context.md']
for item in data.values():
    assert item['paid_provider'] is False and item['oracle_score_claimed'] is False
    assert item['expected_behavior_observed'] is True
    assert item['binding']['functional_sha256'] == freeze['functional_sha256']
    assert item['binding']['prompt_sha256'] == freeze['prompt_sha256']

def observation(case, key):
    return next(o for o in data[case]['observations'] if o['key'] == key)

g_global = observation('golden', 'C1.css_global_during_css')
b_global = observation('css-live-context-leaks', 'C1.css_global_during_css')
assert g_global['positive_authored_global'] and g_global['css_continuation'] and g_global['global_absent_during_css']
assert b_global['positive_authored_global'] and b_global['css_continuation'] and not b_global['global_absent_during_css']
assert g_global['before']['global']['value'] == b_global['before']['global']['value'] == 'do-not-carry'
assert g_global['during_css']['global']['type'] == 'undefined'
assert b_global['during_css']['global']['value'] == 'do-not-carry'

g_timer = observation('golden', 'C1.css_old_timer_cancelled')
b_timer = observation('css-live-context-leaks', 'C1.css_old_timer_cancelled')
for item in [g_timer, b_timer]:
    assert item['timer_positive_observed'] and item['css_superseded_before_due'] and item['css_continuation'] and item['recovery_pass']
    assert item['control']['fired_count'] == 1
    assert item['css_run']['action_at_ms'] - item['queued_at_ms'] < 4000
    assert item['after']['observed_at_ms'] - item['queued_at_ms'] >= 5000
assert g_timer['no_fresh_old_timer'] and not b_timer['no_fresh_old_timer']
assert g_timer['after']['fired_count'] == 0 and b_timer['after']['fired_count'] == 1

stale = {}
for case in ['golden', 'conflict-ui-clears']:
    stale[case] = []
    for item in data[case]['stale_editors']['operations']:
        facts = item['facts']
        assert facts['actual_two_editors'] and facts['positive_operation_control'] and facts['loaded_revision_used']
        assert facts['server_refusal'] and facts['server_unchanged'] and facts['new_conflict_feedback']
        assert facts['reapplied_save_persists'] and facts['current_operation_recovers'] and facts['unrelated_records_unchanged']
        assert facts['exact_draft_retained'] == (case == 'golden')
        raw = item['raw']['stale_refusal']
        if case == 'golden':
            assert raw['expected_dirty'] == raw['retained']
        else:
            assert raw['retained'] == {'title': '', 'filename': '', 'code': ''}
        stale[case].append({'operation': item['operation'], 'facts': facts, 'expected_dirty': raw['expected_dirty'], 'retained': raw['retained'], 'actual_request': raw['refusal']['operation'], 'response_status': raw['refusal']['status']})
    assert {x['operation'] for x in stale[case]} == {'rename', 'delete'}

imports = {}
for case in ['golden', 'js-only-importer']:
    raw = observation(case, 'C3.supported_import_edit_save_load')
    entries = {item['extension']: item for item in raw['items']}
    assert set(entries) == {'js', 'html', 'css', 'JS', 'HTML', 'CSS'}
    imports[case] = []
    for extension, item in entries.items():
        if case == 'golden':
            assert all(item[k] for k in ['import_exact', 'edit_exact', 'save_exact', 'load_exact', 'save_layer_pass'])
        elif extension.lower() == 'js':
            assert item['import_exact'] and item['save_layer_pass']
        else:
            assert item['import_exact'] is False
            if extension.isupper():
                assert item['independent_uppercase_save_fallback'] is True and item['save_layer_pass'] is True
        imports[case].append({k: item.get(k) for k in ['extension', 'import_exact', 'edit_exact', 'save_exact', 'load_exact', 'independent_uppercase_save_fallback', 'save_layer_pass']})

paths['frozen_final_release_inputs'] = freeze_path
mcp_path = GOLDEN / 'run-realm-recipe-mcp-20260927-182118/RESULTS.json'
mcp = json.loads(mcp_path.read_text(encoding='utf-8'))
assert mcp['passed'] and mcp['actual_mcp_tool_dispatch'] and mcp['exact_recipe_same_source_twice']
assert mcp['archive_sha256'] == review['archive_sha256'] and mcp['prompt_sha256'] == freeze['prompt_sha256']
assert mcp['paid_provider'] is False and mcp['platform_run'] is False
assert any(r['visible'] and r['assigned'] and not r['absent'] for r in mcp['before_css_exact_recipe'])
assert any(r['visible'] and r['absent'] and not r['assigned'] for r in mcp['during_css_exact_recipe'])
paths['exact-realm-recipe-mcp'] = mcp_path
index_path = GOLDEN / 'FINAL_PROOF_INDEX.json'
compatibility_path = GOLDEN / 'MCP_RECIPE_COMPATIBILITY.json'
index = json.loads(index_path.read_text(encoding='utf-8'))
assert index['archive']['sha256'] == review['archive_sha256']
assert index['all_five_expected_runs_passed'] and index['focused_fresh_outcomes'] == 9
assert index['whole93_row_judge_claimed'] is False and index['provider_or_platform_calls'] == 0
assert hashlib.sha256(index_path.read_bytes()).hexdigest() == '0c8bebef6be63bfa37a737ba06dbe5c492ad3e6c27b7b697b4b9dcac23a6deff'
assert hashlib.sha256(compatibility_path.read_bytes()).hexdigest() == '311a2b2d6ddb860ee07c5d632662cb0305a36e979e509162107eec284101cbff'
paths['final-proof-index'] = index_path
paths['mcp-recipe-compatibility'] = compatibility_path
for case in ['golden', 'conflict-ui-clears']:
    relative = data[case]['stale_editors']['report_file'].removeprefix('/evidence/')
    path = GOLDEN / relative
    assert path.exists()
    paths[case + '-stale-raw-report'] = path
result = {
  'status': 'Focused reference and three mutant proof artifacts independently reviewed; all four expected outcomes observed, with separate exact-recipe MCP compatibility proof',
  'archive_sha256': review['archive_sha256'],
  'source_hashes': review['source_hashes'],
  'artifact_sha256': {str(path.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths.values()},
  'artifact_cases': list(data), 'provider_run': False, 'oracle_score_claimed': False,
  'final_proof_index': {'path': str(index_path.relative_to(ROOT)).replace('\\', '/'), 'sha256': hashlib.sha256(index_path.read_bytes()).hexdigest(), 'focused_fresh_outcomes': 9},
  'executed_by_this_semantic_reviewer': False,
  'evidence_method': 'Read the runtime agent\'s actual browser-state, UI-request and snapshot artifacts; independently checked their source bindings, relevant positive controls, measured CSS replacement windows and reference/mutant separation.',
  'css_global': {'reference_before': g_global['before']['global'], 'reference_during_css': g_global['during_css']['global'], 'mutant_before': b_global['before']['global'], 'mutant_during_css': b_global['during_css']['global'], 'both_have_actual_css_continuation': True},
  'css_timer': {case: {'positive_fired_count': item['control']['fired_count'], 'second_click_to_css_ms': item['css_run']['action_at_ms']-item['queued_at_ms'], 'observation_after_second_click_ms': item['after']['observed_at_ms']-item['queued_at_ms'], 'late_fired_count': item['after']['fired_count'], 'late_body': item['after']['body'], 'recovery_pass': item['recovery_pass']} for case,item in [('golden',g_timer),('css-live-context-leaks',b_timer)]},
  'stale_operations': stale, 'format_matrix': imports,
  'exact_recipe_mcp': {k: mcp[k] for k in ['scope', 'actual_mcp_tool_dispatch', 'mcp_version', 'chromium', 'recipe_sha256', 'working_control', 'before_css_exact_recipe', 'css_render', 'during_css_exact_recipe', 'positive_matched_realm', 'current_css_matched_realm', 'exact_recipe_same_source_twice', 'passed', 'wall_seconds']},
  'case_summaries': [
    'Reference: authored global present before CSS and undefined during CSS; prior frame detached. First button timer fired, second was pending before CSS, no late callback appeared through more than five seconds, and ordinary recovery worked.',
    'CSS-state mutant: actual CSS styling continued, but the authored global remained and the second timer later changed/logged css-timer-fired-2. Both new detectors rejected the targeted defects.',
    'Conflict-UI mutant: actual stale Rename and Delete requests were refused and server records stayed unchanged, while each real dirty editor lost all three fields. Independent server facts stayed true; draft retention was false. Reference retained and deliberately reapplied all fields.',
    'JS-only importer mutant: JS/JS-uppercase imported, HTML/CSS in either case did not. Independent uppercase HTML/CSS Save fallback still succeeded, demonstrating the two case layers do not inherit each other\'s result.',
    'Supplemental installed-MCP proof: the exact final prompt recipe ran unchanged before and during CSS through browser_run_code_unsafe. Its matched visible authored realm was assigned before CSS and absent in the matched fresh CSS realm afterward; the rendered heading and style controls were present.'
  ],
  'coverage_disposition': 'The earlier C1-C3 Hold reasons are superseded for these concrete observable gaps by changed required protocols plus focused positive/negative witnesses. This does not supersede unrelated unmeasured full-run or architecture limitations.',
  'limits': [
    'The CSS-state mutant is evidence that the new detectors notice the specific state leaks; these artifacts do not claim that it passed every old rubric row.',
    'Only the reference\'s native execution realm was exercised here. Worker/virtual-realm observation and the explained dirty-action-prevention UI alternative remain source-reviewed, not runtime-demonstrated by these four cases.',
    'These are scripted focused browser proofs, not 93 provider verdicts, a complete Functional run, a platform QC run, or a full runtime-fit measurement.',
    'Internal technologies, invisible backend evaluation and exhaustive private-file/program/network guarantees remain outside what these bounded traces prove.'
  ]
}
(OUT / 'runtime_proof_review.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
print(json.dumps({'status': result['status'], 'coverage_disposition': result['coverage_disposition'], 'artifact_count':len(paths)}, indent=2))

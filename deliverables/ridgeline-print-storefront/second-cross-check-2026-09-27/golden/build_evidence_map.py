from pathlib import Path
import hashlib,json,tomllib
out=Path(__file__).resolve().parent
prior=out.parents[1]/'cross-check-2026-09-27'
task=Path.cwd()/'projects/ridgeline-print-storefront'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
identity=json.loads((out/'artifact-identity.json').read_text(encoding='utf-8'))
runtime=json.loads((out/'runtime-binding.json').read_text(encoding='utf-8'))
previous=json.loads((prior/'GOLDEN_CRITERION_EVIDENCE.json').read_text(encoding='utf-8'))
observations=json.loads((out/'boundary-observations.json').read_text(encoding='utf-8'))
assert runtime['passed'] and observations['passed']
assert previous['solution_hashes']==identity['solution_hashes']==runtime['all_19_installed_solution_hashes']
current={p.relative_to(task/'solution').as_posix():sha(p) for p in (task/'solution').rglob('*') if p.is_file()}
assert current==identity['solution_hashes']
assert len(observations['checks'])==8 and all(c['passed'] for c in observations['checks'])
assert not observations['pageErrors']
restart=json.loads((prior/'browser_restart_results.json').read_text(encoding='utf-8'))
phases={p['phase']:p for p in restart['phases']}
assert restart['process_restart']['old_pid']!=restart['process_restart']['new_pid']
assert len(phases['prepare']['evidence']['catalogue']['stocks'])==13
assert phases['prepare']['evidence']['catalogue']==phases['verify']['evidence']['catalogue']
for name in ['cancelled','placed']:
 assert phases['prepare']['evidence'][name]['order']==phases['verify']['evidence'][name]
old={c['id']:c for c in previous['criteria']}
fresh={
 'populated_public_shop_loads':'fresh_gate_order_and_clean_context_lookup',
 'application_health_and_server_data':'fresh_gate_order_and_clean_context_lookup',
 'ridgeline_catalogue_title_search':'combined_discovery_empty_reset_and_native_sort',
 'ridgeline_catalogue_size_filter':'combined_discovery_empty_reset_and_native_sort',
 'ridgeline_catalogue_paper_filter':'combined_discovery_empty_reset_and_native_sort',
 'ridgeline_catalogue_regular_price_ordering':'combined_discovery_empty_reset_and_native_sort',
 'ridgeline_catalogue_alphabetical_title_ordering':'combined_discovery_empty_reset_and_native_sort',
 'variant_stock_and_valid_basket_boundary':'basket_invalid_edit_reload_and_zero_independent_context',
 'ridgeline_unplaced_basket_survives_full_reload':'basket_invalid_edit_reload_and_zero_independent_context',
 'ridgeline_zero_quantity_removal_stays_empty':'basket_invalid_edit_reload_and_zero_independent_context',
 'postage_inclusive_boundaries_and_collection':'collection_checkout_multiline_cancel_and_duplicate_cancel_race',
 'ridgeline_incomplete_delivery_address_refuses_atomically':'whitespace_address_refusals_and_valid_recovery',
 'checkout_retry_identity_and_new_purchase':'lost_last_unit_response_cancelled_elsewhere_then_ui_recovery',
 'cancellation_is_terminal_and_restores_stock_once':'collection_checkout_multiline_cancel_and_duplicate_cancel_race; lost_last_unit_response_cancelled_elsewhere_then_ui_recovery',
 'labelled_controls_and_focus':'exact_keyboard_route_and_focus',
 'theme_and_navigation':'exact_keyboard_route_and_focus; changed_stock_catalogue_and_readonly_presentation',
 'responsive_layout':'changed_stock_catalogue_and_readonly_presentation',
 'interaction_feedback':'combined_discovery_empty_reset_and_native_sort; exact_keyboard_route_and_focus',
}
rows=[];criteria_hashes={};old_files={}
for folder in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
 p=task/'tests'/folder/'judge.toml';criteria_hashes[p.relative_to(task).as_posix()]=sha(p)
 for c in tomllib.loads(p.read_text(encoding='utf-8'))['criterion']:
  prior_c=old[c['id']];assert c['weight']==prior_c['weight']
  for name in prior_c['evidence']:
   file=prior/name;data=json.loads(file.read_text(encoding='utf-8'));assert data.get('passed'),name
   for group in data.get('checks',[]):assert group.get('passed') is not False,name
   old_files[name]=sha(file)
  new=fresh.get(c['id'])
  if folder=='scored/visual':new='changed_stock_catalogue_and_readonly_presentation; 21 new screenshots, sampled rendered review'
  rows.append({'dimension':folder,'id':c['id'],'type':c['type'],'weight':c['weight'],'current_description':c['description'],'reused_exact_evidence':prior_c['evidence'],'reused_observation':prior_c['observation'],'fresh_supplement':new,'result':'locally_supported_with_explicit_reuse' if c['type']=='binary' else 'local_rendered_review_supports_top_anchor_not_a_judge_score'})
assert len(rows)==37 and sum(r['weight'] for r in rows if r['dimension']=='scored/functional')==35
report={'passed':True,'scope':'All 37 current criteria mapped; exact unchanged golden hashes justify old evidence. Fresh supplements do not claim unchanged scenario chains were rerun. Current final-harness evidence is owned separately. No hosted Oracle score measured.','baseline_archive_sha256':identity['archive_sha256'],'current_solution_hashes':current,'current_rubric_hashes':criteria_hashes,'fresh_evidence':{'boundary-mcp-results.json':sha(out/'boundary-mcp-results.json'),'boundary-observations.json':sha(out/'boundary-observations.json'),'boundary-flow.js':sha(out/'boundary-flow.js'),'runtime-binding.json':sha(out/'runtime-binding.json')},'reused_evidence_sha256':old_files,'reused_map_sha256':sha(prior/'GOLDEN_CRITERION_EVIDENCE.json'),'reused_restart_setup_assertions':{'recorded_all_13_before_restart':True,'all_13_after_exactly_match':True,'both_full_receipts_exact':True,'process_pids':[restart['process_restart']['old_pid'],restart['process_restart']['new_pid']]},'criteria':rows,'counts':{'functional':25,'gates':2,'polish':4,'visual':6,'total':37},'functional_weight':35,'fresh_groups':8,'fresh_keyboard_events':len(observations['keyboard']),'fresh_network_observations':len(observations['network']),'fresh_screenshots':len(list(out.glob('*.png'))),'image':'ridgeline-verifier:20260927-crosscheck','image_id':'sha256:6fbd4d7468c34ea8f0035aca4243c9c1c6f7363dd3f9ea16f92eb3ecc097f29a'}
(out/'CRITERION_EVIDENCE.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
md=['# Ridgeline second cross-check: all 37 criteria','','All application files match the prior final archive; old evidence is reused explicitly and hashed in `CRITERION_EVIDENCE.json`. New observations are supplemental unless the table identifies the newly strengthened exact route or filter leg. No hosted Oracle run.','','| Dimension | Criterion | Prior exact evidence | Fresh supplement |','| --- | --- | --- | --- |']
for r in rows:
 names=', '.join('`'+x+'`' for x in r['reused_exact_evidence'])
 md.append('| '+r['dimension']+' | `'+r['id']+'` | '+names+' | '+(r['fresh_supplement'] or 'Reused unchanged scope; no new identical run')+' |')
(out/'CRITERION_MAP.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ['passed','counts','functional_weight','fresh_groups','fresh_keyboard_events','fresh_network_observations','fresh_screenshots']},indent=2))

from pathlib import Path
import copy
import hashlib
import json
import tomllib
import zipfile

root=Path('/workspace')
out=Path('/evidence')
out_rel=Path('deliverables/colderwater-playground-devtools/final-cross-check-2026-09-27/golden')
old_rel=Path('deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27/golden')
task=root/'projects/colderwater-playground-devtools'
digest=lambda data:hashlib.sha256(data).hexdigest()
hashfile=lambda path:digest(path.read_bytes())
read=lambda path:json.loads(path.read_text())
reference=lambda rel:{'path':str(rel).replace('\\','/'),'sha256':hashfile(root/rel)}
prior=read(root/old_rel/'GOLDEN_CRITERION_EVIDENCE.json')
final_zip=root/out_rel.parent/'colderwater-playground-devtools.zip'
assert hashfile(final_zip)=='63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64'
original_zip=root/old_rel.parent/'colderwater-playground-devtools.zip'
assert hashfile(original_zip)=='a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1'
with zipfile.ZipFile(final_zip) as final,zipfile.ZipFile(original_zip) as original:
    prefix='colderwater-playground-devtools/'
    solution={name.split('/solution/',1)[1]:digest(final.read(name)) for name in final.namelist() if '/solution/' in name and not name.endswith('/')}
    old_solution={name.split('/solution/',1)[1]:digest(original.read(name)) for name in original.namelist() if '/solution/' in name and not name.endswith('/')}
    assert len(solution)==23 and solution==old_solution
    assert solution=={str(p.relative_to(task/'solution')).replace('\\','/'):hashfile(p) for p in (task/'solution').rglob('*') if p.is_file()}
    dimensions=['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']
    current=[]
    for dim in dimensions:
        raw=final.read(prefix+f'tests/{dim}/judge.toml')
        assert raw==(task/f'tests/{dim}/judge.toml').read_bytes()
        for criterion in tomllib.loads(raw.decode())['criterion']:current.append((dim,criterion))
    old_prompt=original.read(prefix+'tests/scored/functional/prompt.md').decode()
    new_prompt=final.read(prefix+'tests/scored/functional/prompt.md').decode()
    recipe_heading='## Supplied network-control recipe'
    old_recipe=old_prompt.split(recipe_heading,1)[1]
    new_recipe=new_prompt.split(recipe_heading,1)[1]
    assert old_recipe==new_recipe
    scoped_security={'network_recipe_sha256':digest(new_recipe.encode()),'recipe_byte_identical_to_previous':True,'criterion_hashes':{}}
    old_functional={row['id']:row for row in tomllib.loads(original.read(prefix+'tests/scored/functional/judge.toml').decode())['criterion']}
    for cid in ['cw_runtime_files_not_publicly_exposed','cw_preview_network_requests_blocked']:
        criterion=next(c for _,c in current if c['id']==cid)
        assert criterion==old_functional[cid]
        scoped_security['criterion_hashes'][cid]=digest(json.dumps(criterion,sort_keys=True).encode())
    old_helper=original.read(prefix+'tests/test.sh').decode().split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
    final_helper=final.read(prefix+'tests/test.sh').decode().split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
    assert old_helper==final_helper
    assert original.read(prefix+'tests/tools/restart_mcp.py')==final.read(prefix+'tests/tools/restart_mcp.py')
    restart_source={'generated_helper_template_identical':True,'helper_template_sha256':digest(final_helper.encode()),'restart_mcp_sha256':digest(final.read(prefix+'tests/tools/restart_mcp.py'))}

revised=read(out/'revised_branches_results.json')
example=read(out/'example_only_results.json')
restart=read(out/'restart_sequence_results.json')
assert example['passed'] and restart['passed']
for proof in [revised,example,restart]:
    for name,value in proof['source_sha256'].items():assert solution['app/'+name]==value
    assert proof['chromium']=='Google Chrome for Testing 152.0.7977.8'
    assert proof['mcp']=='Version 0.0.79'
assert revised['functional_sha256']==example['functional_sha256']==hashfile(task/'tests/scored/functional/judge.toml')
successes=[row for row in revised['observations']['checks'] if row['passed']]+example['observations']['checks']
assert len(successes)==6 and len({row['name'] for row in successes})==6 and all(row['passed'] for row in successes)
assert len(restart['prepare']['checks'])==3 and len(restart['verify']['checks'])==2
assert len(restart['prepare']['checks'][-1]['records'])==6
assert restart['verify']['checks'][-1]['previous_records_preserved']==6
assert len([r for r in restart['restart_mcp_responses'] if r['id']==3])==1
summary={'passed':True,'composite_not_single_clean_run':True,'six_changed_branch_groups':successes,
         'five_restart_sequence_groups':restart['prepare']['checks']+restart['verify']['checks'],
         'functional_sha256':revised['functional_sha256'],'final_archive_sha256':hashfile(final_zip),
         'source_23_files_identical_to_tested_original_archive':True,
         'probe_corrections':['The first example branch used rendered innerText, which expands empty CodeMirror lines. That branch stopped before saving. The isolated rerun joins rendered .cm-line text with newlines, verifies exact saved source and passes. No application changed.',
                              'The first expanded restart attempt reused the previous local helper .used marker. Each retry now has its own log directory; exactly one restart_app call succeeded in the final fresh database run. The failed setup and earlier successful five-record run are retained.'],
         'limitations':['Local browser proof, not a paid/provider Oracle evaluation.','Static overlay cases are partial display/input-policy witnesses; the application runtime itself is unchanged.','These are selected independent current branches, not the entire 47-criterion judge in one end-to-end run.']}
(out/'FINAL_GOLDEN_PROOF_SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n')

prior_by={row['id']:row for row in prior['all_current_criteria']}
by_name={row['name']:row for row in successes}
fresh_map={
 'initial_examples':['edited_example_saved_copy_leaves_builtin_original_exact'],
 'cw_completed_preview_interactions':['completed_delayed_click_key_input_then_stop_remains_inactive'],
 'cw_title_change_uniqueness':['positive_padded_unique_create_and_rename_trim_exactly'],
 'cw_shared_run_deadline_recovery':['valid_alternative_shared_original_deadline_with_hidden_candidate'],
 'cw_pending_interaction_budget_nonextension':['new_committed_interaction_rollback_and_pending_second_click','valid_alternative_static_lastgood_overlay_blocks_second_pending_input']}
restart_ids=['cw_saved_source_shared_across_clean_contexts','save_load','cw_process_restart_durability','persistent_snippets']
rows=[]
for dim,criterion in current:
    cid=criterion['id'];row=copy.deepcopy(prior_by[cid]);row['criterion_sha256']=digest(json.dumps(criterion,sort_keys=True).encode())
    row['dimension']=dim;row['weight']=criterion['weight'];row['type']=criterion['type']
    row['prior_evidence_status']=row['status']
    refs=[]
    for ref in row['evidence']:
        if isinstance(ref,str):refs.append(reference(old_rel/ref))
        else:
            actual=reference(Path(ref['path']));assert actual['sha256']==ref['sha256'];refs.append(actual)
    row['evidence']=refs
    if 'fresh_rendered_review' in row:
        row['fresh_rendered_review']=[reference(old_rel/name) for name in row['fresh_rendered_review']]
    row['reuse_basis']='All 23 solution files in current source and final ZIP are byte-identical to the previously tested eight-issue golden. Earlier broad full-QC evidence retains its recorded source binding and explicitly scoped UI-copy-only delta. Prior observations are not represented as current reruns.'
    row['status']='explicitly reused local observed pass' if criterion['type']=='binary' else 'explicitly reused rendered evidence; paid visual rating unmeasured'
    if cid in fresh_map:
        row['previous_observation']=row['observation'];row['observation']=[by_name[name] for name in fresh_map[cid]]
        row['evidence'] += [reference(out_rel/'FINAL_GOLDEN_PROOF_SUMMARY.json'),reference(out_rel/'revised_branches_results.json')]
        if cid=='initial_examples':row['evidence'].append(reference(out_rel/'example_only_results.json'))
        row['status']='fresh changed branches plus source-bound prior evidence for unchanged legs'
    if cid in restart_ids:
        row['previous_observation']=row['observation'];row['evidence'].append(reference(out_rel/'restart_sequence_results.json'))
        row['status']='fresh continuous early-restart sequence plus source-bound prior evidence'
        row['observation']={'five_groups':restart['prepare']['checks']+restart['verify']['checks'],'actual_restart_calls':1,'retained_prior_records':6,'postrestart_dirty_editor_proven':True}
    if cid=='fresh_cancel':row['criterion_change_note']='Only optional pending-candidate visibility and retained/restored wording were relaxed. Existing cancellation/Stop/no-late-work witnesses are stronger than the revised requirement; golden runtime is identical.'
    if cid in scoped_security['criterion_hashes']:row['scoped_reuse']=scoped_security
    assert row['evidence'] and all((root/item['path']).is_file() for item in row['evidence'])
    rows.append(row)
assert len(rows)==47 and len({row['id'] for row in rows})==47
assert sum(row['weight'] for row in rows if row['dimension']=='scored/functional')==49.5
index={'scope':'Final 47-criterion local evidence map. Fresh selected branches and source-bound reused evidence; no paid Oracle score.',
       'counts':{'functional':35,'gates':2,'polish':4,'visual':6,'total':47,'fresh_changed_branch_groups':6,'fresh_restart_sequence_groups':5},
       'candidate_sha256':hashfile(final_zip),'all_current_solution_hashes':solution,'all_current_criteria':rows,
       'limitations':summary['limitations']+['No binary or visual platform score is claimed from this map. All reused records are explicitly labeled.']}
(out/'GOLDEN_CRITERION_EVIDENCE.json').write_text(json.dumps(index,indent=2)+'\n')
fresh_files=['FINAL_GOLDEN_PROOF_SUMMARY.json','revised_branches_results.json','example_only_results.json','restart_sequence_results.json','pending-static-lastgood-overlay.png','revised_fixture_inputs.json','revised_branches.py','revised_branches.cjs','restart_sequence.py','restart_sequence.cjs','restart_sequence_marker_setup_attempt.json','restart_sequence_before_example_requirement.json']
binding={'candidate_archive':str(out_rel.parent/'colderwater-playground-devtools.zip'),'candidate_sha256':hashfile(final_zip),
         'tested_archive_sha256':hashfile(original_zip),'solution_files':solution,'all_23_solution_files_identical':True,
         'functional_sha256':hashfile(task/'tests/scored/functional/judge.toml'),
         'criterion_index':reference(out_rel/'GOLDEN_CRITERION_EVIDENCE.json'),
         'fresh_proofs':{name:hashfile(out/name) for name in fresh_files},
         'reused_source_scoped_proofs':{'prior_index':reference(old_rel/'GOLDEN_CRITERION_EVIDENCE.json'),'prior_solution_binding':reference(old_rel/'golden_evidence_binding.json'),'prepatch_audit':reference(out_rel/'binding/PREPATCH_BINDING_AUDIT.json'),'security_sections':scoped_security,'canonical_restart':restart_source},
         'pinned_browser_image':'sha256:43757904510bf933d70d209e77077ad0173deb345f61a1477eb106f4e2380f6f',
         'browser':'Chromium 152.0.7977.8','installed_playwright_mcp':'0.0.79','fresh_browser_driver':'direct Playwright from installed MCP dependency','actual_restart_driver':'delivered verifier MCP restart_app',
         'paid_provider':False,'all_checks_passed':True}
(out/'golden_evidence_binding.json').write_text(json.dumps(binding,indent=2)+'\n')
print(json.dumps({'passed':True,'criteria':47,'solution_files':23,'fresh_branch_groups':6,'fresh_restart_groups':5,'retained_records_across_restart':6,'final_sha256':hashfile(final_zip)},indent=2))

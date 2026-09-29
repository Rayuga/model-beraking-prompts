from pathlib import Path
import hashlib
import json
import tomllib
import zipfile

root=Path('/workspace');out=Path('/evidence')
relative=Path('deliverables/colderwater-playground-devtools/two-findings-fix-2026-09-27/golden')
baseline_rel=Path('deliverables/colderwater-playground-devtools/final-cross-check-2026-09-27')
task=root/'projects/colderwater-playground-devtools'
sha=lambda data:hashlib.sha256(data).hexdigest()
filehash=lambda path:sha(path.read_bytes())
read=lambda path:json.loads(path.read_text())
ref=lambda path:{'path':str(path).replace('\\','/'),'sha256':filehash(root/path)}
archive=root/relative.parent/'colderwater-playground-devtools.zip';baseline=root/baseline_rel/'colderwater-playground-devtools.zip'
assert filehash(archive)=='5d0f1d74ae48e36183c5110aee5b414fb5912aa30361401950e8a248e1e4e78b'
assert filehash(baseline)=='63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64'
with zipfile.ZipFile(archive) as z,zipfile.ZipFile(baseline) as old:
    prefix='colderwater-playground-devtools/'
    solution={name.split('/solution/',1)[1]:sha(z.read(name)) for name in z.namelist() if '/solution/' in name and not name.endswith('/')}
    previous={name.split('/solution/',1)[1]:sha(old.read(name)) for name in old.namelist() if '/solution/' in name and not name.endswith('/')}
    assert len(solution)==23 and solution==previous
    assert solution=={p.relative_to(task/'solution').as_posix():filehash(p) for p in (task/'solution').rglob('*') if p.is_file()}
    raw=z.read(prefix+'tests/scored/functional/judge.toml');assert raw==(task/'tests/scored/functional/judge.toml').read_bytes()
    functional=tomllib.loads(raw.decode())['criterion'];assert len(functional)==37 and sum(row['weight'] for row in functional)==49.5
    current_hashes={}
    for dimension in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
        for criterion in tomllib.loads(z.read(prefix+'tests/'+dimension+'/judge.toml').decode())['criterion']:
            current_hashes[criterion['id']]={'dimension':dimension,'criterion_sha256':sha(json.dumps(criterion,sort_keys=True).encode()),'type':criterion['type'],'weight':criterion['weight']}
    assert len(current_hashes)==49
    helper=z.read(prefix+'tests/test.sh').decode().split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
    helper_hash=sha(helper.encode());restart_hash=sha(z.read(prefix+'tests/tools/restart_mcp.py'))
normal=read(out/'independence-normal-results.json')
alternative=read(out/'independence-no-duplicate-delete-results.json')
deletion=read(out/'independence-deletion-results.json')
for proof in [normal,alternative,deletion]:
    assert proof['baseline_archive_sha256']==filehash(baseline)
    assert proof['functional_sha256']==sha(raw)
    for name,digest in proof['source_sha256'].items():assert solution['app/'+name]==digest
    assert proof['chromium']=='Google Chrome for Testing 152.0.7977.8'
assert normal['passed'] is False and 'response.status is not a function' in normal['error']
for proof in [normal,alternative]:
    assert proof['prepare']['passed'] and proof['verify']['passed']
    assert proof['actual_restart_calls']==1 and proof['pid_before']!=proof['pid_after']
    assert proof['restart_helper_template_sha256']==helper_hash and proof['restart_mcp_sha256']==restart_hash
    for phase in ['prepare','verify']:
        assert len(proof[phase]['checks'])==1 and proof[phase]['checks'][0]['passed']
        assert proof[phase]['checks'][0]['observed_action_clicks']=={'run':0,'duplicate':0,'delete':0}
        assert not any(row['method']=='DELETE' for row in proof[phase]['writes'])
assert alternative['passed'] and deletion['passed'] and deletion['actual_restart_calls']==0
assert all(not item['present'] for item in alternative['prepare']['capability_overlay']['remaining'])
assert all(item['present'] and item['disabled'] for item in alternative['verify']['capability_overlay']['remaining'])
checks=deletion['deletion']['checks'];assert len(checks)==3 and all(row['passed'] for row in checks)
assert checks[1]['refused']['status']==409 and checks[1]['recovered']['ok']
assert checks[2]['refused']['status']==404 and checks[2]['sibling_recovered']['revision']==checks[2]['sibling']['revision']+1
summary={'passed':True,'composite':True,'clean_single_run_claimed':False,'targeted_criteria':4,'browser_groups':7,
         'ordinary_restart_phases':normal['prepare']['checks']+normal['verify']['checks'],
         'restart_with_unavailable_controls_phases':alternative['prepare']['checks']+alternative['verify']['checks'],
         'independent_deletion_groups':checks,
         'canonical_restart_calls':{'ordinary_run':1,'unavailable_controls_run':1,'deletion_only_rerun':0},
         'final_archive_sha256':filehash(archive),'functional_sha256':sha(raw),'all_23_solution_files_identical_to_tested_baseline':True,
         'retained_probe_failure':ref(relative/'independence-normal-results.json'),
         'probe_correction':'Ordinary restart prepare and verify passed. A later deletion probe used response.status() on browser fetch Response and stopped. The diagnostic remains false. Only the three deletion groups reran after changing that accessor to response.status; all three passed. No application changes.',
         'limitations':['Direct Playwright browser actions; actual canonical verifier MCP only for process restart.','Absent/disabled controls are a temporary browser-DOM capability witness, not a modified shipped implementation.','No paid Oracle/model execution or whole49-criterion end-to-end verdict is claimed.']}
(out/'GOLDEN_PROOF_SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n')
criterion_rows=[]
for cid in ['cw_process_restart_durability','delete_confirm','cw_stale_delete_preserves_newer_record','cw_deleted_identity_rejects_update']:
    evidence=[ref(relative/'GOLDEN_PROOF_SUMMARY.json')]
    if cid=='cw_process_restart_durability':
        evidence += [ref(relative/'independence-normal-results.json'),ref(relative/'independence-no-duplicate-delete-results.json')]
        observation={'ordinary_restart_phases_passed':True,'normal_report_is_retained_composite_diagnostic':True,'unavailable_controls_restart_passed':True,'no_duplicate_delete_run_actions':True}
    else:
        index=['delete_confirm','cw_stale_delete_preserves_newer_record','cw_deleted_identity_rejects_update'].index(cid)
        evidence.append(ref(relative/'independence-deletion-results.json'));observation=checks[index]
    criterion_rows.append({'id':cid,**current_hashes[cid],'status':'fresh local observed pass; composite evidence explicitly scoped','evidence':evidence,'observation':observation})
(out/'SCOPED_CRITERION_EVIDENCE.json').write_text(json.dumps({'scope':'Four revised independence criteria only; root owns the complete49-row map.','criteria':criterion_rows},indent=2)+'\n')
files=['GOLDEN_PROOF_SUMMARY.json','SCOPED_CRITERION_EVIDENCE.json','independence-normal-results.json','independence-no-duplicate-delete-results.json','independence-deletion-results.json','independence_proof.py','independence_proof.cjs','deletion_proof.py','DEPENDENCY_REVIEW.md','GOLDEN_INDEPENDENCE_REVIEW.md']
binding={'passed':True,'candidate_sha256':filehash(archive),'tested_baseline_sha256':filehash(baseline),'solution_files':solution,'all_23_solution_files_unchanged':True,
         'functional_sha256':sha(raw),'current_criterion_hashes':current_hashes,'fresh_proofs':{name:filehash(out/name) for name in files},
         'prior_binding':ref(baseline_rel/'golden/golden_evidence_binding.json'),
         'source_scoped_reuse':'All golden solution files are identical. Earlier47-row evidence is applicable only to unchanged descriptions/behavior and is explicitly reused; these four changed independence rows have new observations. The privacy owner supplies its changed criterion proof separately.',
         'restart_helper_template_sha256':helper_hash,'restart_mcp_sha256':restart_hash,
         'pinned_browser_image':'sha256:43757904510bf933d70d209e77077ad0173deb345f61a1477eb106f4e2380f6f','browser_driver':'direct Playwright','restart_driver':'actual canonical MCP restart_app','paid_provider':False}
(out/'golden_evidence_binding.json').write_text(json.dumps(binding,indent=2)+'\n')
print(json.dumps({'passed':True,'solution_files':23,'current_criteria':49,'fresh_targeted_criteria':4,'browser_groups':7,'composite':True,'candidate_sha256':filehash(archive)},indent=2))

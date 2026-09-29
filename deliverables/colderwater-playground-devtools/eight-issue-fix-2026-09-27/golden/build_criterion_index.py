from pathlib import Path
import hashlib, json, tomllib, difflib, zipfile

out=Path(__file__).resolve().parent
root=out.parents[3]
task=root/'projects/colderwater-playground-devtools'
prior_dir=out.parents[1]/'full-qc-2026-09-27'
prior=json.loads((prior_dir/'GOLDEN_CRITERION_EVIDENCE.json').read_text())
prior_by={c['id']:c for c in prior['criteria']}
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
prior_solution=json.loads((prior_dir/'solution-final.json').read_text())
current_solution={p.relative_to(task/'solution').as_posix():hashfile(p) for p in (task/'solution').rglob('*') if p.is_file()}
unchanged=[p for p in prior_solution if current_solution.get(p)==prior_solution[p]]
for p in ['app/src/runtime.ts','app/server.js','app/src/style.css','app/src/vendor.js','app/public/runner.html','app/package-lock.json','solve.sh']:
    assert p in unchanged,p
with zipfile.ZipFile(prior_dir/'colderwater-playground-devtools.zip') as archive:
    old_app=archive.read('colderwater-playground-devtools/solution/app/src/app.tsx').decode()
new_app=(task/'solution/app/src/app.tsx').read_text()
normalized=new_app.replace("'● Local library'", "'● Local & offline'").replace(", 'aria-describedby': 'keyboard-help'",'').replace("h('span', { id: 'keyboard-help' }", "h('span', null").replace(' · Escape, then Tab Leave editor','')
assert normalized==old_app.replace('\r\n','\n'),'Other app logic changed'
(out/'app-only-copy-delta.diff').write_text(''.join(difflib.unified_diff(old_app.splitlines(True),new_app.splitlines(True),fromfile='full-qc-golden/app.tsx',tofile='current-golden/app.tsx')),encoding='utf-8')
fresh_names={
 'language_dispatch':'language_dispatch_independent',
 'cw_completed_preview_interactions':'completed_preview_interactions_independent',
 'cw_shared_run_deadline_recovery':'shared_original_run_deadline_independent',
 'cw_pending_interaction_budget_nonextension':'pending_interaction_budget_independent',
 'auto_run':'auto_run_measured_negative_windows',
 'persistent_snippets':'persistent_snippets_actual_dirty_editor'
}
summary=json.loads((out/'functional_repair_summary.json').read_text())
fresh_results={r['name']:r for r in summary['observations']['observations']}
rows=[]
for dim in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
    for c in tomllib.loads((task/f'tests/{dim}/judge.toml').read_text())['criterion']:
        row={'id':c['id'],'dimension':dim,'weight':c['weight'],'type':c['type'],'criterion_sha256':hashlib.sha256(json.dumps(c,sort_keys=True).encode()).hexdigest()}
        if c['id'] in fresh_names:
            observed=fresh_results[fresh_names[c['id']]]
            assert observed['passed']
            row.update(status='fresh local observed pass',evidence=['functional_repair_summary.json'],observation=observed)
        elif c['id']=='labelled_controls_and_focus':
            row.update(status='fresh local observed pass including valid alternative',evidence=['keyboard-proof-results.json','undocumented-keyboard-proof-results.json'],observation='Actual editor escape, examples, saved snippet, return to editor and named enabled focus controls. Repeated with escape hint removed from temporary DOM, using actual keys.')
        elif c['id'] in ['cw_runtime_files_not_publicly_exposed','cw_preview_network_requests_blocked']:
            network_path=out.parent/'functional/browser_probe_results.json'
            network=json.loads(network_path.read_text()) if network_path.is_file() else {}
            if network.get('passed'):
                assert all(item['passed'] for item in network['observations'])
                for relative,digest in network['source_binding'].items():
                    assert hashfile(task/'solution/app'/relative)==digest,relative
                selected=[item for item in network['observations'] if ('reserved' in item['name']) == (c['id']=='cw_runtime_files_not_publicly_exposed')]
                row.update(status='fresh local observed pass plus valid-alternative and failure controls',evidence=[{'path':network_path.relative_to(root).as_posix(),'sha256':hashfile(network_path)}],observation=selected)
            else:
                row.update(status='fresh proof pending separate Functional reviewer',evidence=[],observation='Prior bounded privacy classifier no longer used; current reserved-URL and concrete network recipe require their own new MCP evidence.')
        else:
            previous=prior_by[c['id']]
            references=[]
            for relative in previous['evidence']:
                p=prior_dir/relative
                assert p.is_file(),p
                references.append({'path':p.relative_to(root).as_posix(),'sha256':hashfile(p)})
            row.update(status='reused local observed pass' if c['type']=='binary' else 'reused rendered evidence plus fresh manual screenshot review; paid rating unmeasured',evidence=references,observation=previous['observations'],reuse_basis='Runtime, server, installer, vendor, styles, starters and package inputs unchanged; app.tsx differences are badge and optional keyboard help/ARIA only. Prior evidence is not represented as rerun.')
            if c['id']=='cw_execution_budget_termination':
                row['observation']='Prior separately measured braced/unbraced-loop timeout, initial log, rollback and recovery remain sufficient. Old host-theme responsiveness observation is ignored; it is no longer a required behavior.'
            if dim=='scored/visual':
                row['fresh_rendered_review']=['keyboard-help-dark-1440.png','keyboard-help-light-1440.png','keyboard-help-dark-390.png','keyboard-help-light-390.png']
                row['observation']='Fresh final-built screenshots show readable typography, distinct editor/preview/console/library regions, consistent themes and coherent mobile stacking; visual scores remain unmeasured provider judgments. Prior unchanged styling evidence is supplementary.'
        rows.append(row)
assert len(rows)==47 and sum(c['dimension']=='scored/functional' for c in rows)==35
assert sum(c['weight'] for c in rows if c['dimension']=='scored/functional')==49.5
limits=['No provider Oracle/model execution; no Oracle1.0 guarantee.','Visual final screenshots reviewed locally, no paid visual verdict.','No claim the entire47-criterion current judge ran end-to-end. Fresh affected scenarios and unchanged prior witnesses are distinguished.']
if any('pending' in row['status'] for row in rows):limits.append('Privacy/network recipe proof pending separate owner; update this index after results.')
report={'scope':'Current47-criterion evidence index; local observations and explicitly reused evidence, not a hosted Oracle score','counts':{'functional':35,'gates':2,'polish':4,'visual':6,'total':47},'unchanged_solution_files_vs_prior':unchanged,'all_current_solution_hashes':current_solution,'all_current_criteria':rows,'limitations':limits}
(out/'GOLDEN_CRITERION_EVIDENCE.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'criteria':len(rows),'fresh_observed':sum(r['status'].startswith('fresh local') for r in rows),'pending':sum('pending' in r['status'] for r in rows),'unchanged_solution_files':len(unchanged)},indent=2))

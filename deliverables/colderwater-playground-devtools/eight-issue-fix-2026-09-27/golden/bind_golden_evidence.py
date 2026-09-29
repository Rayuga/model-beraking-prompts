from pathlib import Path
import hashlib, json, tomllib, zipfile

out = Path(__file__).resolve().parent
root = out.parents[3]
task = root / 'projects/colderwater-playground-devtools'
sha = lambda body: hashlib.sha256(body).hexdigest()
files = lambda directory: {p.relative_to(directory).as_posix(): sha(p.read_bytes()) for p in directory.rglob('*') if p.is_file()}
solution = files(task / 'solution')
baseline = out.parents[1] / 'metadata-cleanup-2026-09-27/colderwater-playground-devtools.zip'
with zipfile.ZipFile(baseline) as archive:
    prior = {name.split('/solution/', 1)[1]: sha(archive.read(name)) for name in archive.namelist() if '/solution/' in name and not name.endswith('/')}
    old_bundle = archive.read('colderwater-playground-devtools/solution/app/public/assets/index-XwoWsDAE.js').decode()
new_bundle = (task / 'solution/app/public/assets/index-VduTT3aN.js').read_text()
assert old_bundle.replace('Local & offline', 'Local library') == new_bundle, 'Unexpected generated JavaScript change beyond badge'
changed = sorted(p for p in solution.keys() | prior.keys() if solution.get(p) != prior.get(p))
assert changed == ['app/public/assets/index-VduTT3aN.js', 'app/public/assets/index-XwoWsDAE.js', 'app/public/index.html', 'app/src/app.tsx'], changed
build = json.loads((out / 'build_binding.json').read_text())
assert build['after'] == files(task / 'solution/app')
fresh = {}
first = json.loads((out / 'functional-mcp-attempt1-selector.json').read_text())
stale = json.loads((out / 'stale-draft-mcp-results.json').read_text())
assert first['source_binding'] == stale['source_binding']
observations = first['observations']['observations'][:5] + stale['observations']['observations']
assert len(observations) == 6 and all(item['passed'] for item in observations)
summary = {'passed': True, 'composite_fresh_proofs': True, 'source_binding': stale['source_binding'], 'observations': {'observations': observations}, 'source_artifacts': {name: sha((out/name).read_bytes()) for name in ['functional-mcp-attempt1-selector.json','stale-draft-mcp-results.json']}, 'probe_corrections': 'First stale probe used nonexistent Load latest instead of Reload latest. Second attempt observed before asynchronous latest fetch completed. Both attempts preserved; only isolated stale scenario reran with actual button and observed state wait. No application change.', 'paid_provider': False, 'mcp_version': stale['mcp_version'], 'chromium_version': stale['chromium_version']}
(out / 'functional_repair_summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
for name in ['keyboard-proof-results.json', 'undocumented-keyboard-proof-results.json', 'functional_repair_summary.json']:
    data = json.loads((out / name).read_text())
    assert data['passed'], (name, data.get('error'))
    fresh[name] = {'sha256': sha((out / name).read_bytes()), 'passed': True, 'group_count': len(data.get('checks', data.get('observations', {}).get('observations', [])))}
    if 'keyboard' in name:
        for url, digest in data['checks'][0]['hashes'].items():
            assert sha((task / 'solution/app/public' / url.lstrip('/')).read_bytes()) == digest
    else:
        for path, digest in data['source_binding'].items():
            assert sha((task / 'solution/app' / path).read_bytes()) == digest
judges = {dimension: tomllib.loads((task / f'tests/scored/{dimension}/judge.toml').read_text()) for dimension in ['functional', 'polish']}
affected_ids = ['language_dispatch','cw_completed_preview_interactions','cw_shared_run_deadline_recovery','cw_pending_interaction_budget_nonextension','auto_run','persistent_snippets','labelled_controls_and_focus']
criteria = {c['id']: {'description_sha256': sha(c['description'].encode()), 'weight': c['weight'], 'type': c['type']} for judge in judges.values() for c in judge['criterion'] if c['id'] in affected_ids}
assert len(criteria) == len(affected_ids)
report = {'baseline_archive': str(baseline.relative_to(root)), 'baseline_sha256': sha(baseline.read_bytes()), 'solution_files': solution, 'changed_solution_paths': changed, 'generated_javascript_only_badge_text_changed': True, 'unchanged_runtime_server_installer': all(solution[p] == prior[p] for p in ['app/src/runtime.ts','app/server.js','solve.sh']), 'build': {'sha256': sha((out / 'build_binding.json').read_bytes()), 'versions': build['versions'], 'network': False, 'package_install': False}, 'fresh_proofs': fresh, 'affected_criterion_bindings': criteria, 'owned_source_bindings': {p: sha((task/p).read_bytes()) for p in ['tests/scored/polish/judge.toml','tests/scored/polish/prompt.md','solution/app/src/app.tsx']}, 'hosted_oracle_or_model_run': False, 'reused_evidence_scope': 'Prior broad golden/runtime/server/restart proofs apply only to unchanged implementation; six changed Functional scenarios and both keyboard variants were freshly exercised. No full paid judge suite was run.'}
(out / 'golden_evidence_binding.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'changed_solution_paths': changed, 'fresh_proofs': fresh, 'owned_source_bindings': report['owned_source_bindings']}, indent=2))

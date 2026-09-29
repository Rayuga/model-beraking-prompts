"""Guard known Colderwater contract regressions; semantic review is still required."""
import argparse
import json
import re
import tomllib
from pathlib import Path


def check_task(task):
    from check_colderwater_current import check_task as check_current
    return check_current(task)


def check_legacy_task(task):
    """Historical guard retained for inspecting old reports, not new packaging."""
    read = lambda name: (task / name).read_text(encoding='utf-8')
    functional = tomllib.loads(read('tests/scored/functional/judge.toml'))['criterion']
    by_id = {c['id']: c for c in functional}
    description = lambda key: by_id.get(key, {}).get('description', '')
    prompt = read('tests/scored/functional/prompt.md')
    context = read('tests/app_context.md')
    polish = read('tests/scored/polish/judge.toml') + read('tests/scored/polish/prompt.md')
    security = read('environment/instructions/security.md')
    shell = read('tests/test.sh')
    config = tomllib.loads(read('task.toml'))
    rows = []
    def add(name, ok):
        rows.append({'name': name, 'passed': bool(ok)})
    add('37 Functional criteria preserve total49.5', len(functional) == 37 and sum(c['weight'] for c in functional) == 49.5)
    for name, weight in {'language_dispatch': 1.5, 'cw_completed_preview_interactions': 1.0,
                         'cw_shared_run_deadline_recovery': 1.5, 'cw_pending_interaction_budget_nonextension': 1.0}.items():
        add(name + ' independent contribution', by_id.get(name, {}).get('weight') == weight)
    add('loop check requires usability after termination', 'after the run has stopped' in description('cw_execution_budget_termination') and 'While the run is active, the surrounding page remains responsive' not in description('cw_execution_budget_termination'))
    add('prompt does not add during-loop responsiveness', 'test that the host workspace stays responsive' not in prompt)
    add('undocumented standard editor escape accepted', 'even\nwhen the application has no shortcut hint' in polish and 'sequence documented by the application' not in polish)
    auto = description('auto_run')
    add('OFF and queued auto-run windows exceed observed debounce', 'longest successful auto-run delay' in auto and 'plus one second' in auto and 'same measured-delay-plus-margin window' in auto and 'wait two seconds' not in auto.lower())
    stale = description('persistent_snippets')
    add('stale draft proof uses actual B UI', "B's actual dirty UI" in stale and 'retained dirty fields' in stale and 'two real pages' in stale and 'two independently captured' not in stale)
    add('context forbids replay-only draft proof', 'A request replay alone cannot prove the dirty-editor behavior' in context)
    add('proactive conflict prevention remains valid', 'proactive prevention' in context and 'exact draft preservation' in context)
    shared = description('cw_shared_run_deadline_recovery')
    pending = description('cw_pending_interaction_budget_nonextension')
    add('pending candidate visibility is optional', 'Showing failed-loop-candidate while it works is optional' in shared and 'Showing interaction-candidate while it works is optional' in pending and "candidate's provisional DOM need not be shown" in prompt)
    add('pending input may be blocked without extending deadline', 'ignoring/blocking further pending input are both valid' in pending and 'do not force a hidden or disabled control' in pending)
    add('rollback preserves latest successful interaction', 'interaction-committed-log' in pending and 'interaction-committed retained or restored' in pending and 'Restoring interaction-good would wrongly discard' in pending)
    title = description('cw_title_change_uniqueness')
    add('successful title create and rename trim spaces', '"  QC Rename Source  "' in title and '"  QC Rename Source Renamed  "' in title and 'edge spaces trimmed' in title)
    completed = description('cw_completed_preview_interactions')
    add('completed preview Stop prevents later handlers', 'use Stop on this completed preview' in completed and 'none of those handler-marker counts may increase' in completed and 'completed-stop-recovered' in completed)
    examples = description('initial_examples')
    add('example edits save as independent user records', 'QC Example Saved Copy' in examples and 'original filename and source remain unchanged' in examples and 'no particular example names, source language' in examples)
    privacy = description('cw_runtime_files_not_publicly_exposed')
    add('privacy goal does not disclose probe filenames', all(p not in security for p in ['/app.db', '/server.js', '/package.json', '/.git/config', '/package-lock.json']) and 'companion files' in security and 'repository files' in security)
    add('privacy covers exposed companion and project files', all(p in privacy for p in ['/app.db-wal', '/app.db-shm', '/package-lock.json', '/.git/config', '/.git/HEAD']) and 'not a public reserved-name rule' in privacy)
    add('privacy accepts intended public roles and denial precedence', 'An established denial takes precedence' in privacy and 'path actually used by the working playground' in privacy)
    add('privacy has no implementation classifier exception', '64 KiB' not in privacy and 'sole narrow exception' not in prompt and 'Do not read or classify implementation source' in privacy)
    add('network setup supplied and locally fulfilled', 'context.__cwNetworkProbe' in prompt and 'controlPassed: true' in prompt and 'context.unroute' in prompt and 'route.fulfill' in prompt)
    add('tool failure distinguished in trusted structured output', 'EVALUATION_INCOMPLETE:' in context and "reasoning.lstrip().startswith('EVALUATION_INCOMPLETE:')" in shell and 'evaluation-incomplete.json' in shell)
    add('ordinary app failures are not infrastructure errors', 'never use it for an observed app defect' in context and 'row.get(\'error\') is not None' in shell)
    add('RewardKit omitted empty reasoning is schema valid', "reasoning = row.get('reasoning', '')" in shell and 'isinstance(reasoning, str)' in shell)
    ids = [c['id'] for c in functional]
    add('single restart occurs after basic save/load', ids.index('cw_process_restart_durability') == ids.index('save_load') + 1 and sum('Call the verifier MCP tool restart_app exactly once' in c['description'] for c in functional) == 1)
    restart = description('cw_process_restart_durability')
    add('restart setup does not depend on duplicate or delete', 'using only New and ordinary Save' in restart and 'make an independent duplicate' not in restart and 'QC Restart Deleted' not in restart and 'do not require running their source' in restart)
    add('three deletion outcomes keep separate earned credit', all(by_id.get(key, {}).get('weight') == 1.0 for key in ['delete_confirm', 'cw_stale_delete_preserves_newer_record', 'cw_deleted_identity_rejects_update']) and 'Replay the real delete operation' not in description('delete_confirm') and 'do not require or grade confirmation here' in description('cw_stale_delete_preserves_newer_record'))
    add('Auto-run absence is not an unrelated gate prerequisite', 'disable it if that control is available' in context and 'must not by itself fail Render, Constraints or unrelated checks' in context)
    add('hard task metadata without grading history', config['metadata']['difficulty'] == 'hard' and not re.search(r'QC|Jordan|criteria|judge', config['task']['description'] + config['metadata']['provenance'], re.I))
    add('public-network app badge is accurate', 'Local &amp; offline' not in read('solution/app/src/app.tsx') and 'Local & offline' not in read('solution/app/src/app.tsx') and 'Local library' in read('solution/app/src/app.tsx'))
    add('EXIT cleanup bounded before wait', 'for _ in $(seq 1 50)' in shell.split('probe_ready()')[0] and 'for _ in $(seq 1 20)' in shell.split('probe_ready()')[0] and 'if ! ps -p "$APP_PID"' in shell.split('probe_ready()')[0])
    add('canonical timeouts retained', config['agent']['timeout_sec'] == 7200 and config['verifier']['timeout_sec'] == 13200)
    return {'task': str(task), 'scope': 'Known-source regression guards, not platform QC or a complete semantic proof', 'passed': all(r['passed'] for r in rows), 'checks': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('task', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = check_task(args.task)
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': report['passed'], 'checks': len(report['checks']), 'failed': [c['name'] for c in report['checks'] if not c['passed']]}))
    raise SystemExit(0 if report['passed'] else 1)

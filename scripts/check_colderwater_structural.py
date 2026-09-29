"""Source guards for shared scenarios; these do not certify judge timing or fairness."""
import re
import tomllib
from decimal import Decimal


def check_task(task):
    read = lambda name: (task / name).read_text(encoding='utf-8')
    parsed = tomllib.loads(read('tests/scored/functional/judge.toml'))
    rows = parsed['criterion']
    by_id = {row['id']: row for row in rows}
    prompt = read('tests/scored/functional/prompt.md')
    context = read('tests/app_context.md')
    shell = read('tests/test.sh')
    config = tomllib.loads(read('task.toml'))
    security = read('environment/instructions/security.md')
    polish = read('tests/scored/polish/judge.toml')
    checks = []

    def add(name, passed):
        checks.append({'name': name, 'passed': bool(passed)})

    add('93 Functional outcomes', len(rows) == 93)
    add('unique binary positive Functional outcomes', len(by_id) == len(rows) and all(
        row['type'] == 'binary' and row['weight'] > 0 for row in rows))
    add('Functional total remains49.5', sum(Decimal(str(row['weight'])) for row in rows) == Decimal('49.5'))
    original_budgets = ['0.5', '1.5', '1', '2.5', '1.25', '0.5', '0.5', '1.75', '3.5',
                        '1', '1', '1', '1', '1', '1.5', '1.5', '2', '0.5', '1', '1',
                        '1.5', '2.5', '3', '1.5', '1.5', '2.5', '1', '1', '1', '1.25',
                        '0.75', '0.5', '2', '0.5', '1', '1.5', '1']
    keys = []
    totals = {}
    for row in rows:
        match = re.search(r'\b(S\d{2})\.([a-z0-9_]+)\b', row['description'])
        if match:
            key = '.'.join(match.groups())
            keys.append(key)
            totals[match[1]] = totals.get(match[1], Decimal(0)) + Decimal(str(row['weight']))
    add('one unique evidence key per outcome', len(keys) == len(rows) and len(set(keys)) == len(keys))
    add('all37 original feature budgets conserved', totals == {
        f'S{i + 1:02}': Decimal(value) for i, value in enumerate(original_budgets)})
    add('all evidence scenarios have protocols', all(re.search(r'^#{2,4} .*\b' + scenario + r'\b', prompt, re.M) for scenario in totals))
    groups = {
        'startup and immutable examples separated': ['cw_startup_ready', 'cw_usable_examples', 'cw_example_separate'],
        'dispatch and CSS isolation separated': ['cw_js_html_filename_dispatch', 'cw_css_apply_snapshot', 'cw_extension_case', 'cw_css_inert_copy', 'cw_css_global_freshness', 'cw_css_pending_timer_cancelled'],
        'title policies separated': ['cw_title_trimming', 'cw_rename_title_only', 'cw_title_collision_refusal', 'cw_title_empty_rejected', 'cw_title_case_sensitive'],
        'import and no-execution separated': ['cw_supported_file_import', 'cw_import_off_no_execution', 'cw_import_unsupported_extension', 'cw_import_extension_case', 'cw_saved_filename_extension_case'],
        'saved filename extension and path rules separated': ['cw_saved_filename_extension_rejection', 'cw_saved_filename_path_rejection'],
        'delete UI and server protections separated': ['cw_delete_confirmation_cancel', 'cw_delete_confirmed_selected_only', 'cw_stale_delete_refusal', 'cw_deleted_identity_update_refusal'],
        'dirty editor and server stale refusal separated': ['cw_stale_save_server_refusal', 'cw_stale_save_draft_recovery', 'cw_stale_rename_refusal', 'cw_stale_rename_draft_recovery', 'cw_stale_delete_refusal', 'cw_stale_delete_draft_recovery'],
        'three command shortcuts independently scored': ['cw_shortcut_run', 'cw_shortcut_save', 'cw_shortcut_clear'],
    }
    for name, ids in groups.items():
        add(name, all(key in by_id for key in ids))
    add('shared scenario setup replaces per-criterion setup', 'shared scenario' in prompt.lower() and
        'Each functional criterion creates its own distinct titles' not in context and
        'never inherit another outcome' in context.lower())
    add('original single-batch architecture retained', parsed['judge']['mode'] == 'batched' and
        parsed['judge']['timeout'] == 9000 and parsed['scoring']['aggregation'] == 'weighted_mean')
    add('source and implementation evidence forbidden', 'Never inspect submitted implementation files' in prompt and
        'never response-body classification or downloaded implementation contents' in prompt)
    add('network controls retain local fulfillment and cleanup', all(x in prompt for x in
        ['context.__cwNetworkProbe', 'controlPassed: true', 'context.unroute', 'route.fulfill']))
    add('privacy probe paths remain private and broad', all(p in prompt and p not in security for p in
        ['/app.db', '/app.db-wal', '/app.db-shm', '/server.js', '/package.json', '/package-lock.json', '/npm-shrinkwrap.json', '/.git/config', '/.git/HEAD']))
    add('app network policy distinct from snippet boundary', 'CDN assets used by the app are allowed' in context and
        'not an app-wide network restriction' in context)
    add('no unrequested during-loop host responsiveness', 'Do not require unrelated controls to respond during a loop' in prompt and
        'While the run is active, the surrounding page remains responsive' not in prompt)
    add('pending output and input implementation alternatives retained', 'Pending DOM display is optional' in prompt and
        'Do not force hidden/disabled controls' in prompt)
    add('control handoffs use observed facts and independent fallbacks', 'currentLastGood' in prompt and
        'A failure must not cascade from a missing inherited baseline' in prompt and
        'establish that receiving protocol' in prompt)
    add('independent rows retain meaningful protocol controls',
        'only each short outcome defines its pass boundary' not in prompt and
        'Judge its named outcome together with the successful controls' in prompt and
        'not a second score or a prerequisite that another row receive a pass' in prompt)
    add('off-state Auto-run requires observed automatic execution', all(
        'automatically with Auto-run on' in by_id.get(key, {}).get('description', '') and
        'dead Auto-run feature cannot pass' in by_id.get(key, {}).get('description', '')
        for key in ('cw_autorun_off_stays_idle', 'cw_autorun_off_cancels_queue')))
    add('CSS inert copy requires retained clickable target', all(text in
        by_id.get('cw_css_inert_copy', {}).get('description', '') for text in
        ['visible enabled button', 'click', 'removed, blank, hidden or disabled', 'style correctness is scored separately']))
    add('CSS globals observed during CSS with positive matched-realm control', all(text in prompt for text in
        ['Before any later JavaScript Run', 'oldGlobal actually equals do-not-carry',
         'an inaccessible read for undefined', 'otherwise unobservable architecture']) and
        'Functional S02 has a separate narrow permitted-observation limitation' in context)
    add('CSS pending timer has matching actual firing control', all(text in prompt for text in
        ['css-timer-start-1', 'css-timer-fired-1', 'css-timer-start-2', 'css-timer-fired-2',
         'until at least five seconds from the second click', 'mere absence from a timer that never fired']))
    add('Rename and Delete each retain and recover actual dirty editor', all(
        phrase in prompt.split(f'### S{n:02d} ')[1].split('### S')[0]
        for n in (25, 28) for phrase in ['live editors A and B', 'title, filename and source',
        'deliberately', 'reapply']) and 'Replay alone cannot prove retention' in
        by_id['cw_stale_rename_draft_recovery']['description'] and
        'Replay alone cannot prove retention' in by_id['cw_stale_delete_draft_recovery']['description'])
    add('all supported import formats covered directly', all(text in prompt.split('### S33 ')[1].split('### S34 ')[0]
        for text in ['import-me.js', 'import-me.html', 'import-me.css', 'html-import-edited',
        'css-import-edited', 'reload the workspace']) and
        'Each lowercase .js, .html and .css import' in by_id['cw_supported_file_import']['description'])
    add('uppercase import and server filename credit separated', 'cw_source_file_extension_case' not in by_id and
        all(key in by_id for key in ['cw_import_extension_case', 'cw_saved_filename_extension_case']) and
        'If uppercase import fails' in prompt and 'If uppercase Save fails' in prompt)
    add('privacy uses ordered exclusive evidence decisions', all(text in prompt for text in
        ['Classify each candidate in this order', 'Only after the accepted outcomes above are excluded',
         'terminal classification: do not also label that response an exposure',
         'Mere HTTP 200', 'never use EVALUATION_INCOMPLETE for that observed failure']))
    add('shared context names narrow privacy observation limitation', all(text in context for text in
        ['Functional S06 also defines one narrow permitted-observation limitation',
         'Plain successful file delivery with no such role evidence',
         'same observation never receives both classifications']))
    add('import negative outcomes retain successful capability controls',
        'deliberate Run then produces' in by_id['cw_import_off_no_execution']['description'] and
        'actually accepted a supported control file' in by_id['cw_import_unsupported_extension']['description'])
    add('title and filename refusals retain valid write controls', all(
        'observed successful valid current title write' in by_id[key]['description']
        for key in ('cw_title_collision_refusal', 'cw_title_empty_rejected')) and all(
        'observed valid supported-filename write' in by_id[key]['description']
        for key in ('cw_saved_filename_extension_rejection', 'cw_saved_filename_path_rejection')))
    add('JS freshness uses actual new execution and a live global control', all(text in
        by_id['cw_js_fresh_document']['description'] for text in ['fresh-js-log', 'executed A setter/start',
        'window.__cancelLeak', 'cancellation timing need not pass']) and
        "post-CSS absence of oldGlobal alone is not a global-freshness control" in prompt)
    add('unsupported refusal has a fallback independent of harmless words',
        'If the harmless-word control is refused' in prompt and
        'separate unsupported-execution probes' in prompt and
        'preserves the scope-control last-good preview' not in prompt)
    add('restart early without unrelated feature setup', "S21 then immediately S22's single actual restart" in prompt and
        'no Duplicate/Delete/execution prerequisite' in prompt)
    add('undocumented standard editor escape accepted', 'Standard or native editor behavior does not need application help text' in polish and
        'sequence documented by the application' not in polish)
    add('Auto-run absence does not cascade into gates', 'must not by itself fail Render, Constraints or unrelated checks' in context)
    add('actual second editor required for dirty-draft proof', 'A request replay alone cannot prove dirty-editor behavior' in context and
        'proactive conflict prevention' in context and 'exact draft retention' in context)
    s23 = prompt.split('### S23 ')[1].split('### S24 ')[0]
    add('stale Save dirties and recovers all three editor fields', all(text in s23 for text in
        ['title QC Concurrent Save Draft', 'filename qc-concurrent-draft.js',
         "source console.log('stale-overwrite');", "Confirm each differs from B's loaded baseline",
         "Reapply B's recorded unsaved title, filename and source", 'verify all three exact fields']))
    add('all requested controls are labelled and keyboard reachable', all(text in polish for text in
        ['Run, Stop, Auto-run, Clear console', 'New, Save, Rename, Duplicate, Delete, Import and Export',
         'each action be a separate Tab stop', 'hidden file input',
         'do not delete, rename, duplicate, import or export work merely to inspect focus']))
    add('report guard retains evaluator-incomplete distinction', 'EVALUATION_INCOMPLETE:' in context and
        "reasoning.lstrip().startswith('EVALUATION_INCOMPLETE:')" in shell and "row.get('error') is not None" in shell)
    add('RewardKit optional empty reasoning remains accepted', "reasoning = row.get('reasoning', '')" in shell)
    add('canonical agent and verifier timeouts retained', config['agent']['timeout_sec'] == 7200 and config['verifier']['timeout_sec'] == 13200)
    add('short hard product metadata', config['metadata']['difficulty'] == 'hard' and not re.search(
        r'QC|Jordan|criteria|judge', config['task']['description'] + config['metadata']['provenance'], re.I))
    add('public-network badge remains accurate', 'Local & offline' not in read('solution/app/src/app.tsx') and
        'Local library' in read('solution/app/src/app.tsx'))
    add('bounded EXIT cleanup retained', all(s in shell.split('probe_ready()')[0] for s in
        ['for _ in $(seq 1 50)', 'for _ in $(seq 1 20)', 'if ! ps -p "$APP_PID"']))
    return {'task': str(task), 'scope': 'Known shared-scenario source guards; not platform QC, runtime measurement or a semantic proof',
            'passed': all(check['passed'] for check in checks), 'checks': checks}

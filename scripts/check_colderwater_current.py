"""Current reduced-scope source guards; runtime and semantic review are separate."""
import re
import tomllib
from decimal import Decimal
from pathlib import Path

def check_task(task):
    task=Path(task)
    template=Path(__file__).resolve().parents[1]/'projects/webdev-task-template'
    read=lambda p:(task/p).read_text(encoding='utf-8')
    checks=[]
    def add(name,ok): checks.append({'name':name,'passed':bool(ok)})
    config=tomllib.loads(read('task.toml')); ref=tomllib.loads((template/'task.toml').read_text())
    add('task keys match template',set(config)==set(ref) and all(not isinstance(v,dict) or set(config[k])==set(v) for k,v in ref.items()))
    add('canonical limits and verifier env',all(config[k]==ref[k] for k in ['agent','environment','verifier']))
    for rel in ['tests/test.sh','tests/Dockerfile','environment/Dockerfile','tests/scoring.toml','tests/tools/score.py','tests/tools/restart_mcp.py','tests/.dockerignore']:
        add('template-identical '+rel,(task/rel).read_bytes()==(template/rel).read_bytes())
    allids=[];dimensions={}
    for rel in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
        base='tests/'+rel
        data=tomllib.loads(read(base+'/judge.toml')); standard=tomllib.loads((template/base/'judge.toml').read_text())
        dimensions[rel.split('/')[-1]]=data
        add(rel+' canonical judge and aggregation',data['judge']==standard['judge'] and data['scoring']==standard['scoring'])
        prompt=read(base+'/prompt.md')
        add(rel+' browser prompt and substitution',all(x in prompt for x in ['http://localhost:3000','{criteria}','{app_context}','untrusted']))
        add(rel+' nonempty valid positive rows',all(c['weight']>0 and c['description'].strip() and c['type'] in ('binary','likert') for c in data['criterion']))
        allids.extend(c['id'] for c in data['criterion'])
    add('unique outcome ids',len(allids)==len(set(allids)))
    rows=dimensions['functional']['criterion'];by_id={r['id']:r for r in rows}
    prompt=read('tests/scored/functional/prompt.md');context=read('tests/app_context.md')
    protocols=set(re.findall(r'^### (S\d{2})\b',prompt,re.M))
    keys=[re.match(r'(S\d{2})\.([a-z0-9_]+):',r['description'].strip()) for r in rows]
    add('79 independent functional outcomes at32.85',len(rows)==79 and sum(Decimal(str(c['weight'])) for c in rows)==Decimal('32.85'))
    add('restart survival examples and later writing have independent credit',by_id['cw_process_restart_durability']['weight']==1.8 and by_id['cw_process_restart_write']['weight']==0.5 and by_id.get('cw_restart_example_inventory',{}).get('weight')==0.2 and 'do not inherit the durability verdict' in by_id['cw_process_restart_write']['description'])
    add('23 bounded protocols exactly cover every evidence key',len(protocols)==23 and all(keys) and {m[1] for m in keys if m}==protocols and len({m[0] for m in keys if m})==len(rows))
    add('no dangling scenario references',set(re.findall(r'\bS\d{2}\b',prompt+context))<=protocols)
    add('fixed harness has no custom incomplete zero rule','EVALUATION_INCOMPLETE' not in prompt+context+read('tests/test.sh') and 'validate_suite' not in read('tests/test.sh'))
    add('no hidden CSS or private-file classification probes',all(k not in by_id for k in ['cw_css_global_freshness','cw_working_files_private']) and not any(x in prompt for x in ['matched-realm','private-looking','/package.json','/app.db-wal']))
    add('looping Promise callback covered','promise-loop-entered' in prompt and 'looping Promise callback' in by_id['cw_literal_loop_deadline']['description'])
    add('shared callback deadline uses positive marker control',all(x in prompt for x in ['nested-control-done','late-callback-entered','forbidden-nested-completion','}, 3000); }, 3000);']) and 'ten-second observation' in by_id['cw_callback_shared_run_deadline']['description'])
    add('Auto-run negatives have working positive control',all('dead Auto-run feature cannot pass' in by_id[k]['description'] for k in ['cw_autorun_off_stays_idle','cw_autorun_off_cancels_queue']))
    add('pending cancellation has matching successful timer control',all('callback actually fires in the uncancelled control' in by_id[k]['description'] for k in ['cw_supersede_pending','cw_stop_pending_execution']) and 'count must not increase above the positive-control baseline' in prompt)
    add('withdrawn CSS copy outcomes absent and simple CSS run covered',all(k not in by_id for k in ['cw_css_apply_snapshot','cw_css_inert_copy','cw_css_pending_timer_cancelled','cw_css_pending_preview','cw_css_timer_recovery']) and 'built-in sample page' in by_id['cw_css_builtin_preview']['description'] and 'css-timer-' not in prompt)
    add('network proof has local positive control and cleanup',all(x in prompt for x in ['controlPassed: true','route.fulfill','context.unroute','context.__cwNetworkProbe']))
    add('dirty Save tests actual three-field editor and recovery',all(x in prompt for x in ['title QC Concurrent Save Draft','filename qc-concurrent-draft.js',"source console.log('stale-overwrite');",'Reapply B\'s recorded unsaved title, filename and source']) and 'A request replay alone cannot prove dirty-editor behavior' in context)
    add('restart early with only New and Save','immediately S22' in prompt and 'Call the verifier MCP tool restart_app exactly once' in prompt)
    add('no during-loop responsiveness demand','Do not require unrelated controls to respond during a loop' in prompt)
    polish=dimensions['polish']['criterion'];pids={c['id'] for c in polish}
    add('six Polish outcomes avoid Functional feedback duplicate',len(polish)==6 and sum(c['weight'] for c in polish)==3 and 'interaction_feedback' not in pids and {'cw_controls_have_names','cw_controls_keyboard_reachable','cw_controls_focus_visible','cw_keyboard_library_navigation'}<=pids)
    add('standard editor escape needs no help text','Standard editor escape keys are valid without documentation' in read('tests/scored/polish/judge.toml'))
    public=read('instruction.md')+'\n'+'\n'.join(p.read_text(encoding='utf-8') for p in (task/'environment/instructions').glob('*.md'))
    add('removed workflows no longer requested',not re.search(r'\b(rename|renaming|duplicate makes|deleting|Importing|Export downloads|importing over|draggable|bracket matching)\b',public,re.I))
    add('public runtime and product request intact',all(s in public for s in ['node /app/server.js','/app/app.db','five seconds','two open editors']))
    add('launch contract discloses variable current directory','current working directory may be outside /app' in public and 'rather than assuming where the command was started' in public)
    add('restart example inventory has public coverage and independent observation','same built-in example choices, without extra copies' in public and 'S22.restart_example_inventory' in prompt and 'If saved records fail, still compare the example inventory' in prompt)
    add('public CSS uses built-in sample without prior-style copy', 'For CSS, apply the stylesheet to a small built-in sample page' in public and 'copy of the last successful document' not in public)
    add('extension capitalization is optional and has no duplicate outcome', 'cw_extension_case' not in by_id and not re.search(r'case.insensitive|capitals in the extension|uppercase extension', public+context, re.I) and all('dispatch.'+ext in prompt for ext in ['js','html','css']) and not any('dispatch.'+ext in prompt for ext in ['JS','HTML','CSS']) and 'other extension capitalizations is optional' in prompt)
    add('completed Stop retention is independently scored', by_id.get('cw_completed_stop_preview',{}).get('weight')==0.1 and by_id['cw_completed_stop']['weight']==0.2 and 'independently of handler suppression' in by_id['cw_completed_stop_preview']['description'])
    add('restart readback covers all actual saved fields', 'every actual saved record' in by_id['cw_process_restart_durability']['description'] and 'exact source and revision' in by_id['cw_process_restart_durability']['description'])
    add('public launch names all injected environment variables', all(v in public for v in ['PATH=', 'NODE_PATH=', 'HOME', 'PORT=', 'DB_PATH']))
    add('public packaging discloses exact symlink exception',all(s in public for s in ['Symbolic links are unsupported except links beneath /app/node_modules','fully resolved targets also stay beneath /app/node_modules','Broken links are unsupported']))
    add('rollback and recovery have separate owners',all('cw_'+kind+'_error_recovery' in by_id and 'Later execution is scored separately' in by_id['cw_'+kind+'_error_rollback']['description'] for kind in ['js','html','timer','promise']))
    add('plain rejection and complete HTML async line probes',all(s in prompt for s in ["Promise.reject('primitive-error-marker')", "Promise.reject('html-promise-error-marker')", "new Error('html-async-error-marker')"]))
    add('finite braced unbraced and Promise loops control termination',all(s in prompt for s in ['finite-braced','finite-unbraced','finite-promise','Expect 3, 4 and 3']))
    add('title refusals cover creation as well as updates','NEW creation' in by_id['cw_title_collision_refusal']['description'] and 'NEW creation' in by_id['cw_title_empty_rejected']['description'])
    add('duration requires observed elapsed measurement and terminal states','constant numeric placeholder' in by_id['cw_console_duration']['description'] and 'cw_terminal_durations' in by_id)
    add('isolation permits legitimate host title updates','Legitimate app-owned title/status changes are allowed' in by_id['cw_preview_origin_boundary']['description'])
    add('text-only storage has bounded controlled canary without universal assurance claim','cw_save_load_execution_canary' in by_id and 'not proof that all server evaluation is absent' in by_id['cw_save_load_execution_canary']['description'])
    add('HOME is staging rather than guaranteed app location','HOME is a writable staging directory and may differ from the directory containing server.js' in public)
    add('installer refuses unverifiable or active database reset', all(s in read('solution/solve.sh') for s in ['bigint: true','error.code === \'ENOENT\'','if (gone(error)) continue; throw error;','cannot safely reset the database']))
    add('pending replacement observes each supported language', all(k in by_id for k in ['cw_supersede_pending','cw_pending_html_supersession','cw_pending_css_supersession']) and all(s in prompt for s in ['replacement.html','replacement.css','the shared matching A callback control']))
    add('later interaction error has independent message line and rollback credit', all(k in by_id for k in ['cw_completed_error_message','cw_completed_error_line','cw_completed_error_rollback']) and all(s in prompt for s in ['late-interaction-failure','interactionLastGood','line 5','failed-partial-picture']))
    add('unsupported execution probes have visible authored markers', all(s in prompt for s in ['unsupported-eval-executed','unsupported-function-executed','unsupported-wasm-completed','unsupported-worker-executed','unsupported-import-executed','quoted inside an error explanation is not evidence']))
    return {'task':str(task),'scope':'Source regression guards; not a hosted QC verdict or Oracle measurement','passed':all(c['passed'] for c in checks),'checks':checks}

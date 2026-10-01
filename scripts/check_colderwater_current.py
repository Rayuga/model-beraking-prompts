"""Current history-candidate guards. Source guards are not semantic or runtime QC."""
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
    add('82 functional outcomes at45.25',len(rows)==82 and sum(Decimal(str(c['weight'])) for c in rows)==Decimal('45.25'))
    add('22 protocols cover unique evidence keys',len(protocols)==22 and all(keys) and {m[1] for m in keys if m}==protocols and len({m[0] for m in keys if m})==len(rows))
    add('no dangling scenario references',set(re.findall(r'\bS\d{2}\b',prompt+context))<=protocols)
    add('no custom incomplete-zero rule','EVALUATION_INCOMPLETE' not in prompt+context+read('tests/test.sh') and 'validate_suite' not in read('tests/test.sh'))
    add('no hidden execution-realm or private-file classifier',not any(x in prompt for x in ['matched-realm','private-looking','/package.json','/app.db-wal']))
    removed={'cw_startup_ready','cw_usable_examples','cw_example_separate','cw_restart_example_inventory','cw_css_builtin_preview','cw_pending_css_supersession','cw_theme_actual_switch','cw_theme_work_preserved','cw_title_trimming','cw_title_collision_refusal','cw_title_empty_rejected','cw_title_case_sensitive','cw_title_refusal_recovery'}
    add('withdrawn features have no scored owners',not(removed&set(by_id)))
    public=read('instruction.md')+'\n'+'\n'.join(p.read_text(encoding='utf-8') for p in (task/'environment/instructions').glob('*.md'))
    add('withdrawn requirements absent from public notes',not re.search(r'light and dark themes|supply.*examples|CSS styles its built-in|titles.*unique|trim spaces at their edges',public,re.I))
    add('public launch contract preserved',all(x in public for x in ['node /app/server.js','/app/app.db','current working directory may be outside /app','DB_PATH','PORT=','NODE_PATH=','HOME','PATH=','Symbolic links are unsupported except links beneath /app/node_modules']))
    add('history and retry promises public',all(x in public for x in ['immutable snapshot','same attempt','exactly one','process restart','two editors','unsaved fields']))
    add('history has independently owned outcomes',all(x in by_id for x in ['cw_history_snapshots','cw_history_inspection_draft','cw_history_inspection_saved_head','cw_history_inspection_no_execution','cw_history_restore','cw_restore_retry','cw_history_reload','cw_history_stale_restore','cw_history_stale_restore_draft','cw_racing_saves','cw_racing_save_restore','cw_history_restart','cw_restore_retry_restart']))
    add('navigation protections have independent owners',all(x in by_id for x in ['cw_document_switch_cancels_queue','cw_document_switch_open_does_not_run']))
    add('actual input-state rollback probe',all(x in prompt for x in ['user-edited-preview-741','Do not edit or rerun the source to set it','recorded user-entered value']))
    add('queued-run probes have continuing positive controls',all(x in prompt for x in ['manual_consumes_queue','document_switch_cancels_queue','Next make a genuine edit','measured-delay-plus-margin']))
    add('safe script-string fixture is authored data',"const scriptText = '</script><script>not executable</script>'" in prompt)
    add('network proof has local controls and cleanup',all(x in prompt for x in ['controlPassed: true','route.fulfill','context.unroute','context.__cwNetworkProbe']))
    add('looping Promise and complete HTML async errors covered',all(x in prompt for x in ['promise-loop-entered','html-async-error-marker','html-promise-error-marker','finite-promise']))
    add('no during-loop responsiveness demand','Do not require unrelated controls to respond during a loop' in prompt)
    add('rollback and later execution separate',all('cw_'+k+'_error_recovery' in by_id and 'cw_'+k+'_error_rollback' in by_id for k in ['js','html','timer','promise']))
    add('actual dirty-editor evidence required','A request replay alone cannot prove dirty-editor behavior' in context and 'two real editors' in prompt)
    polish=dimensions['polish']['criterion']
    add('six independent Polish outcomes',len(polish)==6 and sum(c['weight'] for c in polish)==3 and {'cw_controls_have_names','cw_controls_keyboard_reachable','cw_controls_focus_visible','cw_keyboard_library_navigation'}<={c['id'] for c in polish})
    add('standard editor escape accepted','Standard editor escape keys are valid without documentation' in read('tests/scored/polish/judge.toml'))
    add('installer refuses unverifiable reset',all(x in read('solution/solve.sh') for x in ['bigint: true','cannot safely reset the database','if (gone(error)) continue; throw error;']))
    return {'task':str(task),'scope':'Source regression guards; not a hosted QC verdict or Oracle measurement','passed':all(c['passed'] for c in checks),'checks':checks}

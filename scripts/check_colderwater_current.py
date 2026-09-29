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
    add('57 independent functional outcomes at32.70',len(rows)==57 and sum(Decimal(str(c['weight'])) for c in rows)==Decimal('32.70'))
    add('23 bounded protocols exactly cover every evidence key',len(protocols)==23 and all(keys) and {m[1] for m in keys if m}==protocols and len({m[0] for m in keys if m})==len(rows))
    add('no dangling scenario references',set(re.findall(r'\bS\d{2}\b',prompt+context))<=protocols)
    add('fixed harness has no custom incomplete zero rule','EVALUATION_INCOMPLETE' not in prompt+context+read('tests/test.sh') and 'validate_suite' not in read('tests/test.sh'))
    add('no hidden CSS or private-file classification probes',all(k not in by_id for k in ['cw_css_global_freshness','cw_working_files_private']) and not any(x in prompt for x in ['matched-realm','private-looking','/package.json','/app.db-wal']))
    add('looping Promise callback covered','promise-loop-entered' in prompt and 'looping Promise callback' in by_id['cw_literal_loop_deadline']['description'])
    add('shared callback deadline uses positive marker control',all(x in prompt for x in ['nested-control-done','late-callback-entered','forbidden-nested-completion','}, 3000); }, 3000);']) and 'one-second wall-clock distinction' in by_id['cw_callback_shared_run_deadline']['description'])
    add('Auto-run negatives have working positive control',all('dead Auto-run feature cannot pass' in by_id[k]['description'] for k in ['cw_autorun_off_stays_idle','cw_autorun_off_cancels_queue']))
    add('CSS inert result needs retained working target',all(x in by_id['cw_css_inert_copy']['description'] for x in ['visible enabled button','removed, blank, hidden or disabled','style correctness is scored separately']))
    add('network proof has local positive control and cleanup',all(x in prompt for x in ['controlPassed: true','route.fulfill','context.unroute','context.__cwNetworkProbe']))
    add('dirty Save tests actual three-field editor and recovery',all(x in prompt for x in ['title QC Concurrent Save Draft','filename qc-concurrent-draft.js',"source console.log('stale-overwrite');",'Reapply B\'s recorded unsaved title, filename and source']) and 'A request replay alone cannot prove dirty-editor behavior' in context)
    add('restart early with only New and Save','immediately S22' in prompt and 'Call the verifier MCP tool restart_app exactly once' in prompt)
    add('no during-loop responsiveness demand','Do not require unrelated controls to respond during a loop' in prompt)
    polish=dimensions['polish']['criterion'];pids={c['id'] for c in polish}
    add('seven Polish outcomes preserve weight4',len(polish)==7 and sum(c['weight'] for c in polish)==4 and {'cw_controls_have_names','cw_controls_keyboard_reachable','cw_controls_focus_visible','cw_keyboard_library_navigation'}<=pids)
    add('standard editor escape needs no help text','Standard editor escape keys are valid without documentation' in read('tests/scored/polish/judge.toml'))
    public=read('instruction.md')+'\n'+'\n'.join(p.read_text(encoding='utf-8') for p in (task/'environment/instructions').glob('*.md'))
    add('removed workflows no longer requested',not re.search(r'\b(rename|renaming|duplicate makes|deleting|Importing|Export downloads|importing over|draggable|bracket matching)\b',public,re.I))
    add('public runtime and product request intact',all(s in public for s in ['node /app/server.js','/app/app.db','five seconds','two open editors']))
    add('public supports CSS no old scripts/timers/handlers',all(s in public for s in ['old scripts','active timers or event handlers']))
    return {'task':str(task),'scope':'Source regression guards; not a hosted QC verdict or Oracle measurement','passed':all(c['passed'] for c in checks),'checks':checks}

from pathlib import Path
import hashlib,json,re,shutil,tomllib

out=Path(__file__).resolve().parent
root=out.parents[3]
task=root/'.qc-cache/coldwater-2026-09-29-round2/task'
old=root/'deliverables/colderwater-playground-devtools/last-attempt-repair-2026-09-28/golden/drivers'
assert task.is_dir() and old.is_dir()
shutil.copytree(old,out/'drivers',dirs_exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
text=(task/'tests/scored/functional/prompt.md').read_text()
headers=list(re.finditer(r'^### (S\d{2})[^\n]*$',text,re.M))
criteria=[]
for row in tomllib.loads((task/'tests/scored/functional/judge.toml').read_text())['criterion']:
 keys=list(dict.fromkeys(re.findall(r'\bS\d{2}\.[a-z0-9_]+',row['description'])))
 assert keys
 criteria.append({**row,'evidence_keys':keys})
scenarios={}
for i,h in enumerate(headers):
 end=headers[i+1].start() if i+1<len(headers) else text.index('\n## Binary outcome descriptors',h.start())
 protocol=text[h.start():end]
 scenarios[h[1]]={'heading':h[0],'protocol':protocol,'protocol_sha256':hashlib.sha256(protocol.encode()).hexdigest(),'evidence_keys':list(dict.fromkeys(k for c in criteria for k in c['evidence_keys'] if k.startswith(h[1]+'.')))}
files={p.relative_to(task/'solution').as_posix():sha(p) for p in (task/'solution').rglob('*') if p.is_file()}
assert len(criteria)==57 and len(scenarios)==23 and len(files)==23
manifest={'freeze_confirmed':True,'round_input_sha256':'f7258ff3b83e02bd781bc1d4ed013f8b125d0a31cf246ef3b6193a3410020fe2','provider_or_platform':False,'functional_sha256':sha(task/'tests/scored/functional/judge.toml'),'prompt_sha256':sha(task/'tests/scored/functional/prompt.md'),'context_sha256':sha(task/'tests/app_context.md'),'restart_script_sha256':sha(task/'tests/test.sh'),'restart_mcp_sha256':sha(task/'tests/tools/restart_mcp.py'),'solution_files':files,'criteria':criteria,'scenarios':scenarios,'scope':'Fresh frozen Round 2 scripted reference behavior; not an Oracle or provider score.'}
(out/'frozen_round2_inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
p=out/'drivers/runtime_flow.cjs'
code=p.read_text()
code=code.replace("const fresh=await d.body();say('js_fresh_document'", "const fresh=await d.body();state.round2FreshJS={body:fresh,logs:await d.logs(),passed:fresh.includes('fresh-undefined')&&!fresh.includes('html-dispatch-ok')&&(await d.logs()).includes('fresh-js-log')};say('js_fresh_document'")
start=code.index("  }else if(id==='S04'){")
end=code.index("  }else if(id==='S05'){",start)
replacement=r'''  }else if(id==='S04'){
    const previousGood=await reuseGood('cancel-good');
    const aSource="window.__cancelLeak = 'A';\ndocument.body.innerHTML = '<p id=\"run-A\">candidate-A</p>';\nconsole.log('cancel-A-started');\nsetTimeout(() => console.log('cancel-A-delayed'), 4000);";
    const beforeControl={started:count(await d.logs(),'cancel-A-started'),delayed:count(await d.logs(),'cancel-A-delayed')};
    const controlClock=await d.run(aSource,'cancel-a.js');
    const positive={clock:controlClock,body:await d.body(),started:count(await d.logs(),'cancel-A-started'),delayed:count(await d.logs(),'cancel-A-delayed')};
    assert(positive.started===beforeControl.started+1&&positive.delayed===beforeControl.delayed+1,'S04 matching four-second callback positive control did not run');
    const baseline=positive.delayed;
    await good(previousGood.marker,previousGood.log_marker);
    const a=await d.run(aSource,'cancel-a.js',false);
    await p.waitForFunction(n=>document.querySelector('[role="log"]')?.textContent.split('cancel-A-started').length-1>n,positive.started,{timeout:8500});
    const pending=await d.status();
    const b=await d.run("document.body.innerHTML = '<p id=\"run-B\">run-B-' + typeof window.__cancelLeak + '</p>';\nconsole.log('cancel-B-started');",'cancel-b.js');
    assert(b.action_at_ms-a.action_at_ms<4000,'Cancellation setup missed pending window');
    await l.wait(p,Math.max(0,a.action_at_ms+6200-l.relative()),'Observe beyond superseded timer deadline against positive-control baseline');
    const bBody=await d.body(),bLogs=await d.logs(),afterSupersede=count(bLogs,'cancel-A-delayed');
    say('supersede_pending',/running|waiting/i.test(pending)&&afterSupersede===baseline&&bBody.includes('run-B-'),{positive_control:positive,pending,a,b,body:bBody,delayed_baseline:baseline,delayed_after:afterSupersede});
    emit('S02.js_fresh_document',Boolean(state.round2FreshJS?.passed&&bBody.includes('run-B-undefined')&&bLogs.includes('cancel-B-started')&&count(bLogs,'cancel-A-started')>positive.started),{first_fresh_JS:state.round2FreshJS,executed_A_started_count:count(bLogs,'cancel-A-started'),positive_control_started:positive.started,B_body:bBody,B_log_observed:bLogs.includes('cancel-B-started'),cancellation_verdict_not_inherited:true});
    const stopBaseline=count(bLogs,'stop-delayed'),startBaseline=count(bLogs,'stop-started');
    const stop=await d.run("console.log('stop-started');document.body.innerHTML='<p>stop-candidate</p>';setTimeout(()=>console.log('stop-delayed'),4000);",'stop.js',false);
    await p.waitForFunction(n=>document.querySelector('[role="log"]')?.textContent.split('stop-started').length-1>n,startBaseline,{timeout:8500});
    const active=await d.status();
    await l.action('stop','Stop active timer run',()=>p.getByRole('button',{name:'Stop',exact:true}).click());const feedback=await d.status();
    await l.wait(p,Math.max(0,stop.action_at_ms+4300-l.relative()),'Observe beyond stopped timer scheduled time');
    const restored=await d.body(),logs=await d.logs(),stopAfter=count(logs,'stop-delayed');const recovered=await recovery('stop-recovered');
    say('stop_pending_execution',/running|waiting/i.test(active)&&/stop|cancel/i.test(feedback)&&stopAfter===stopBaseline&&recovered,{matching_positive_control:positive,active,feedback,delayed_baseline:stopBaseline,delayed_after:stopAfter,recovered});
    say('stop_pending_rollback',restored===bBody,{last_good:bBody,restored});
'''
code=code[:start]+replacement+code[end:]
p.write_text(code)
print(json.dumps({'criteria':len(criteria),'protocols':len(scenarios),'solution_files':len(files),'manifest':str(out/'frozen_round2_inputs.json'),'runtime_driver_sha256':sha(p)}))

from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
source=(ROOT/'reports/common-ground-ballot/2026-09-15-recovery-r17/mcp-recovery.cjs').read_text(encoding='utf-8')
source=source[:source.index('\nmain().catch')].replace('async function main()','async function legacyMain()')
source=source.replace('const h = browser.__recoverySmoke;', 'const h = browser.__recoverySmoke;\nconst e = browser.__ballotEvidence;')
start=source.index('async function exchange(')
end=source.index('function watch(',start)
source=source[:start]+'''async function exchange(p, label, act, lose = false) {
  const row=await e.capture(p,label,act,{match:isStaff,mode:lose?'drop':'observe'});
  if(row.state!=='captured')throw new Error(JSON.stringify(row));
  const saved={request:{path:row.request.url.replace(/^https?:\\/\\/[^/]+/,''),method:row.request.method,body:JSON.stringify(row.request.body)},
    status:row.response.status,response:row.response.body,replay:row.response.replay||null,lost:lose};
  h.exchanges[label]=saved;
  if(lose){await p.locator('[data-pending-retry="'+op(saved)+'"]').waitFor({state:'visible'});
    await p.waitForFunction(id=>!document.querySelector('[data-pending-retry="'+id+'"]')?.disabled,op(saved));}
  else await p.locator('[data-pending-id="'+op(saved)+'"]').waitFor({state:'detached'});
  await p.waitForLoadState('networkidle');return saved;
}
''' + source[end:]
needle="  await call('tools/call', {name: 'browser_navigate', arguments: {url: 'http://localhost:3000'}});"
source=source.replace(needle,needle+"\n  const installed=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/tests/browser-evidence.js'}});\n  retain('helper-installed',installed);assert(!installed.result?.isError);")
source+='\n'+(OUT/'helper-extra.cjs').read_text(encoding='utf-8')+'''
async function main(){
  if(process.argv.includes('--boundary-only')){
    await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'boundary-isolation',version:'1'}});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\\n');
    await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
    await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/tests/browser-evidence.js'}});
    await run('setup',"browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};return {identity:await signin(page,'ruth')};");
  }else await legacyMain();
  await additional();
}
main().catch(async error=>{
  results.push({name:'helper integration failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;
  try{await run('failure-retained-evidence','return e.dump();');}catch{}
}).finally(()=>{
  fs.writeFileSync('/results/helper-results.json',redact({mcpVersion:version,scoredOracle:false,helperLoadedByFilename:true,
    passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));
  child.kill();
});
'''
(OUT/'helper-integration.cjs').write_text(source,encoding='utf-8',newline='\n')
runner=(ROOT/'reports/common-ground-ballot/2026-09-15-oracle-failure-r17/run-mcp-repro.py').read_text(encoding='utf-8')
runner=runner.replace('mcp-failure-repro.cjs','helper-integration.cjs').replace('timeout=180','timeout=500')
runner=runner.replace('import hashlib','import hashlib\nimport os')
runner=runner.replace("['node', '/validation/helper-integration.cjs']", "['node', '/validation/helper-integration.cjs'] + (['--boundary-only'] if os.environ.get('HELPER_BOUNDARY_ONLY') else [])")
(OUT/'run-helper.py').write_text(runner,encoding='utf-8',newline='\n')
(OUT/'helper-integration').mkdir(exist_ok=True)
print('Prepared actual pinned MCP helper integration driver')

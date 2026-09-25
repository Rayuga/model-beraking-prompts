async function main() {
  await call('initialize', {protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'helper-loading-test',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const listing=await call('tools/list',{});
  retain('helper-tool-schema',listing.result.tools.filter(tool=>tool.name==='browser_run_code_unsafe'));
  await call('tools/call',{name:'browser_navigate',arguments:{url:'about:blank'}});
  const result=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{code:`async(page)=>{const result={requireType:typeof require,processType:typeof process,setTimeoutType:typeof setTimeout};try{const fs=await import('node:fs');result.dynamicImport=true;result.readFileType=typeof fs.readFileSync;}catch(error){result.dynamicImport=false;result.importError=String(error);}return result;}`}});
  retain('helper-capabilities',result);
  console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>child.kill());

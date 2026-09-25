const {spawn} = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
let commits = 0;
const server = http.createServer((request, response) => {
  if (request.url === '/commit') {
    commits++;
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify({committed: true, count: commits}));
    return;
  }
  response.writeHead(200, {'Content-Type': 'text/html'});
  response.end('<button id="confirm">Confirm</button><p id="status">Ready</p><script>document.querySelector("#confirm").onclick=async()=>{const b=document.querySelector("#confirm");b.disabled=true;try{await fetch("/commit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:"test"})});document.querySelector("#status").textContent="Acknowledged"}catch{document.querySelector("#status").textContent="Uncertain"}}</script>');
});
const child = spawn('playwright-mcp', ['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'], {stdio:['pipe','pipe','pipe']});
const pending = new Map();
let index = 0;
let output = '';
let stderr = '';
child.stderr.on('data', data => stderr += data);
child.stdout.on('data', data => {
  output += data;
  let newline;
  while ((newline = output.indexOf('\n')) >= 0) {
    const line = output.slice(0, newline); output = output.slice(newline + 1);
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (pending.has(value.id)) { pending.get(value.id)(value); pending.delete(value.id); }
  }
});
async function call(method, params) {
  const id = ++index;
  let timer;
  try {
    return await Promise.race([new Promise(resolve => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({jsonrpc:'2.0', id, method, params})+'\n');
    }), new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('MCP request timed out')),30000);})]);
  } finally {clearTimeout(timer);}
}
async function main() {
  await new Promise(resolve => server.listen(3000,'0.0.0.0',resolve));
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'pellmoor-helper-smoke',version:'1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const inventory=await call('tools/list',{});
  fs.writeFileSync('/evidence/mcp-tools.json',JSON.stringify(inventory,null,2));
  console.log(inventory.result.tools.map(tool=>tool.name).join(', '));
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const helper=fs.readFileSync('/source/tests/functional/capture-loss.js','utf8');
  const code='async (page) => {\n'+helper+'\nreturn await captureCommittedLoss(page,{url:"http://localhost:3000/commit",method:"POST",activate:()=>page.locator("#confirm").click(),observePending:async()=>({disabled:await page.locator("#confirm").isDisabled()}),activateAgain:()=>page.locator("#confirm").evaluate(button=>button.click())});\n}';
  const result=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{code}});
  fs.writeFileSync('/evidence/mcp-helper-result.json',JSON.stringify({scope:'Actual Playwright MCP helper compatibility against a synthetic transport fixture, not product scoring',result,commits,stderr},null,2));
  assert(!result.error && !result.result?.isError,JSON.stringify(result));
  const text=result.result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
  const parsed=JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
  assert.equal(parsed.setup_error,null);
  assert.equal(parsed.requests_while_pending,1);
  assert.equal(parsed.requests.length,1);
  assert.equal(parsed.requests[0].status,200);
  assert.equal(parsed.requests[0].response_json.committed,true);
  assert.equal(parsed.requests[0].request_headers['content-type'],'application/json');
  assert(!('cookie' in parsed.requests[0].request_headers));
  assert(!('authorization' in parsed.requests[0].request_headers));
  assert.equal(parsed.pending.disabled,true);
  assert.equal(commits,1);
  console.log('PASS actual browser_run_code_unsafe captures one committed response and cleans up interception');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{child.kill();server.close();});

from pathlib import Path

here = Path(__file__).resolve().parent
original = Path('qc/runs/coldwater-2026-10-01-history-hardening-r1/per-row-review/evidence/39/mock-floor.cjs')
server = original.read_text(encoding='utf-8').split('async function main(){')[0]
probe = r'''
async function main(){
 await new Promise(resolve=>server.listen(3102,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto('http://localhost:3102');
  const run=async source=>{await page.getByLabel('Source',{exact:true}).fill(source);await page.getByRole('button',{name:'Run',exact:true}).click();return{preview:await page.locator('#preview').innerText(),console:await page.locator('#console').innerText()};};
  const literal='mock-control-'+Date.now();const control=await run(`document.body.textContent='${literal}';console.log('${literal}');`);
  assert.equal(control.preview,literal);assert(control.console.includes(literal));
  await page.getByRole('button',{name:'Clear console',exact:true}).click();
  const marker='calculation-'+Date.now(),a=23,b=41,expected=marker+':'+(a+b);
  const source=`const marker=${JSON.stringify(marker)},a=${a},b=${b};const output=marker+':'+(a+b);document.body.textContent=output;console.log(output);`;
  const actual=await run(source);const passesGate=actual.preview===expected&&actual.console.includes(expected);
  report.scope='Original literal-string mock, unchanged renderer, checked against corrected Render prerequisite; no configured judge';
  report.observations={control,source,expected,actual,passesGate};assert.equal(passesGate,false);report.passed=true;
 }finally{await browser.close();}
}
main().catch(error=>{report.error=String(error);process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/computed-mock-gate.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));server.close();});
'''
(here/'drivers/computed_mock_gate.cjs').write_text(server+probe, encoding='utf-8', newline='\n')

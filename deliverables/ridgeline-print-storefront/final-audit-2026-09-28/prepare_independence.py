from pathlib import Path
ROOT=Path.cwd();OUT=Path(__file__).resolve().parent
source=(OUT/'golden/boundary-flow.js').read_text(encoding='utf-8')
prefix=source.split('  try{\n    await page.setViewportSize',1)[0]
flow=r'''
  try{
    await page.setViewportSize({width:1440,height:1000});await page.locator('.print-card').first().waitFor();
    const control=await buy(lines(['RP-103','A3',1]),'Independent quantity control');
    const before=(await stocks())['RP-103:A3'];equal(before,19,'one control deducted');
    await basket(lines(['RP-103','A3',3]));await add('RP-103','A3',2);await page.getByRole('button',{name:/Open basket,/}).click();
    const uiMerge=await page.locator('.basket-line').count()===1&&await page.getByRole('spinbutton',{name:'Quantity for Nine Windows A3',exact:true}).inputValue()==='5';
    const duplicate=fresh(control.body);duplicate.lines=lines(['RP-103','A3',3],['RP-103','A3',2]);
    const dupResult=await request('/api/orders',duplicate);const duplicatePass=dupResult.status===201&&dupResult.body.lines.length===1&&dupResult.body.lines[0].qty===5&&dupResult.body.total_pence===18445;
    const current=(await stocks())['RP-103:A3'];equal(current,__EXPECTED_STOCK__,'observed stock after duplicate request');
    const bad=[];
    for(const qty of [0,-1,1.5]){
      const input=fresh(control.body);input.lines=lines(['RP-103','A3',qty]);const r=await request('/api/orders',input);
      require(r.status>=400&&!r.body.reference,'invalid quantity refused');equal((await stocks())['RP-103:A3'],current,'invalid quantity leaves stock');equal(await order(control.saved.reference),control.saved,'control receipt retained');bad.push({qty,status:r.status});
    }
    const over=fresh(control.body);over.lines=lines(['RP-103','A3',current],['RP-103','A3',1]);
    const overResult=await request('/api/orders',over);require(overResult.status>=400&&!overResult.body.reference,'combined overstock refuses');equal((await stocks())['RP-103:A3'],current,'overstock leaves stock');
    const unknown=fresh(control.body);unknown.lines=lines(['RP-103','A3',1],['RP-999','A3',1]);const unknownResult=await request('/api/orders',unknown);require(unknownResult.status>=400&&!unknownResult.body.reference,'unknown mixed line refused');equal((await stocks())['RP-103:A3'],current,'unknown line deducts nothing');
    report.outcomes={ui_merge:uiMerge,server_duplicate_merge:duplicatePass,combined_overstock:true,invalid_quantities:true,unknown_variant:true};
    require(uiMerge,'UI positive merge control');equal(duplicatePass,__DUPLICATE_EXPECTED__,'intended duplicate outcome');
    report.checks.push({id:'independent_partial_failure',passed:true,invalidResponses:bad,duplicateStatus:dupResult.status,stockAfterDuplicate:current});
    report.passed=true;
  }catch(e){report.passed=false;report.error=e.stack||String(e);}
  report.finishedAt=new Date().toISOString();return report;
}
'''
for name,stock,passed in [('golden',14,'true'),('duplicate-reject',19,'false')]:
    target=OUT/'independence'/name;target.mkdir(parents=True,exist_ok=True)
    (target/'boundary-flow.js').write_text(prefix+flow.replace('__EXPECTED_STOCK__',str(stock)).replace('__DUPLICATE_EXPECTED__',passed),encoding='utf-8')
    (target/'run_mcp.py').write_bytes((OUT/'golden/run_mcp.py').read_bytes())
print('prepared golden and duplicate-reject mutant fixtures')

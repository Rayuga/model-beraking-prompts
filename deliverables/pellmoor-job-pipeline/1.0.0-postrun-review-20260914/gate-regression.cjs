const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
let browser;
const record={scope:'Local browser regression for the revised authentication gate; not a judge score'};
async function main(){
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const good=await browser.newContext();const page=await good.newPage();
 await page.goto('http://localhost:3000');await page.locator('#email').fill('hiring@pellmoor.test');await page.locator('#password').fill('password123');
 const populated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/roles'&&r.status()===200);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const response=await populated;const url=response.url();assert((await response.text()).includes('ROLE-014'));
 await page.locator('#board .cand').first().waitFor();await page.reload();await page.locator('#board .cand').first().waitFor();
 const anonymous=await browser.newContext();const anon=await anonymous.newPage();await anon.goto('http://localhost:3000');
 const read=()=>anon.evaluate(async url=>{const token=localStorage.getItem('pellmoor_session_v2');const r=await fetch(url,{headers:token?{Authorization:'Bearer '+token}:{}});return {status:r.status,body:await r.text()};},url);
 const before=await read();
 await anon.locator('#email').fill('hiring@pellmoor.test');await anon.locator('#password').fill('Wrong-Pellmoor-123');
 const refused=anon.waitForResponse(r=>new URL(r.url()).pathname==='/api/login');
 await anon.getByRole('button',{name:'Sign in',exact:true}).click();const bad=await refused;
 const after=await read();
 assert.equal(bad.status(),401);assert(await anon.locator('#signin').isVisible());
 for(const r of [before,after]){assert([401,403].includes(r.status));assert(!/ROLE-01[4-7]|CAND-10[1-9]|Ilse Vandal|Bench joiner/.test(r.body));}
 await page.reload();await page.locator('#board .cand').first().waitFor();
 Object.assign(record,{protected_route:new URL(url).pathname,correct_login_and_reload:true,before_wrong_password:before,wrong_password_status:bad.status(),after_wrong_password:after,good_session_remains_valid:true,cleared_anonymous_credentials:false,passed:true});
 console.log('PASS anonymous protected read before/after wrong-password UI attempt and independent valid-session refresh');
}
main().catch(e=>{record.error=e.stack;record.passed=false;process.exitCode=1;console.error(e);}).finally(async()=>{fs.writeFileSync('/evidence/gate-regression.json',JSON.stringify(record,null,2));if(browser)await browser.close();});

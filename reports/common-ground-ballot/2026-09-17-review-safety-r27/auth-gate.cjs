const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const dimensions=['render','constraints','functional','polish','visual'];
const url='http://localhost:3000';
async function authGate(){
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const results=[];
  try {
    for(const dimension of dimensions){
      const contexts=[];
      const observations=[];
      let stage='public sign-in surface';
      try {
        const page=async()=>{
          const context=await browser.newContext({viewport:{width:1280,height:800}});
          contexts.push(context);
          const p=await context.newPage();
          await p.goto(url);
          await p.locator('#login-view').waitFor({state:'visible'});
          assert(!await p.locator('#app-view').isVisible());
          return p;
        };
        const signIn=async(p,password)=>{
          await p.getByLabel('Email',{exact:true}).fill('ruth.adebayo@commonground.example');
          await p.getByLabel('Password',{exact:true}).fill(password);
          const pending=p.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/auth/login');
          await p.getByRole('button',{name:'Sign in',exact:true}).click();
          return pending;
        };
        const rejectPassword=async(p,label)=>{
          const r=await signIn(p,'CommonGround!wrong');
          observations.push({stage:label,status:r.status()});
          assert.equal(r.status(),401,'wrong_password_rejected');
          await p.locator('#login-error').getByText('Email or password is incorrect.').waitFor();
          assert(!await p.locator('#app-view').isVisible());
        };
        const a=await page();
        stage='wrong_password_rejected';
        await rejectPassword(a,'wrong password before valid sign-in');
        stage='valid_login_and_backend';
        const collection=a.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/ballots');
        const signedIn=await signIn(a,'CommonGround!2026');
        assert.equal(signedIn.status(),200);
        await a.locator('#app-view').waitFor({state:'visible'});
        assert.equal(await a.locator('#user-name').innerText(),'Ruth Adebayo');
        assert.equal(await a.locator('#user-role').innerText(),'Coordinator');
        const response=await collection;
        assert.equal(response.status(),200);
        const records=(await response.json()).ballots;
        assert(records.length>=4);
        const known=records.map(b=>b.id);
        const route=new URL(response.url()).pathname;
        const read=async p=>p.evaluate(async route=>{
          const r=await fetch(route);
          return {status:r.status,body:await r.json()};
        },route);
        const state=async()=>a.evaluate(async()=>{
          const result={};
          for(const path of ['/api/ballots','/api/members','/api/audit']){
            const r=await fetch(path);result[path]=await r.json();
          }
          return result;
        });
        const before=await state();
        await a.reload();await a.locator('#app-view').waitFor({state:'visible'});
        assert.deepEqual(await state(),before);
        observations.push({stage:'valid login and refreshed protected collection',status:200,records:records.length});
        const b=await page();
        const deniedRead=async label=>{
          const r=await read(b);
          observations.push({stage:label,status:r.status,known_records_leaked:known.filter(id=>JSON.stringify(r.body).includes(id)).length});
          assert.equal(r.status,401,'anonymous_read_denied');
          assert(known.every(id=>!JSON.stringify(r.body).includes(id)),'denial_body_contains_no_records');
          assert(!await b.locator('#app-view').isVisible());
        };
        stage='anonymous_read_denied';
        await deniedRead('protected read before wrong login');
        stage='wrong_password_rejected';
        await rejectPassword(b,'wrong password in independent anonymous context');
        stage='post_failure_read_denied';
        await deniedRead('protected read after wrong login; no credentials cleared');
        assert.deepEqual(await state(),before,'gate must not mutate domain records');
        results.push({dimension,passed:true,observations});
        console.log('PASS shared authentication gate',dimension);
      }catch(error){
        results.push({dimension,passed:false,stage,error:error.message,observations});
        console.log('FAIL shared authentication gate',dimension,stage,error.message);
      }finally{
        for(const c of contexts)await c.close();
      }
    }
  }finally{await browser.close();}
  fs.writeFileSync('/results/auth-gate-results.json',JSON.stringify({scope:'Local golden-specific browser assertions of the shared gate, not LLM verdicts',results},null,2)+'\n');
  return results;
}
module.exports=authGate;
if(require.main===module)authGate().then(r=>{process.exitCode=r.every(x=>x.passed)?0:1;}).catch(e=>{console.error(e);process.exitCode=1;});


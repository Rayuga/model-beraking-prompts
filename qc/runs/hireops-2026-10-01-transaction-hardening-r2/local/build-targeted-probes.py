from pathlib import Path
p=Path(__file__).resolve().parent
source=(p/'batch-ui.cjs').read_text()
prefix=source[:source.index(" await editor(p,'UI-COMMIT')")]
ending=source[source.index(" assert.deepEqual(errors,[])"):]
golden=r'''
 await editor(p,'PREPARE-RECOVERY');
 const baseField=page.getByLabel('Member 1 Base salary (dollars)',{exact:true});
 await baseField.fill('999999.99');
 const refused=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/preview'));
 await page.getByRole('button',{name:'Preview coordinated change',exact:true}).click();
 assert.equal((await refused).status(),409);
 const editorForm=page.getByRole('form',{name:'Coordinated change editor'});
 await editorForm.getByRole('alert').filter({hasText:/exceeds requisition/}).waitFor();
 assert.equal(await baseField.inputValue(),'999999.99');
 assert.equal(await page.getByLabel('Member 1 Signing bonus (dollars)',{exact:true}).inputValue(),'1.23');
 assert.equal(await page.getByLabel('Member 1 destination requisition',{exact:true}).inputValue(),p.b);
 assert.equal(await page.getByLabel('Member 2 Equity fair value (dollars)',{exact:true}).inputValue(),'2.03');
 await page.screenshot({path:out+'/prepare-refusal.png',fullPage:true});
 await baseField.fill('10.00');await preview();
 await current.getByRole('button',{name:'Commit reviewed change',exact:true}).click();
 await page.getByRole('heading',{name:/PREPARE-RECOVERY.*COMMITTED/}).waitFor();
 record('actual over-budget prepare refusal explains failure, retains member terms and supports corrected commit');
 const data=await api('u','/api/bootstrap'),employee=data.employees[0];
 const reqId=await req(),offerId='FINANCIAL-DISPLAY';
 await api('r','/api/offers',{id:offerId,req_id:reqId,candidate:'Display candidate',start_date:'2024-02-29T12:34:56.789Z',referred_by:employee.id,referred_hire_start:'2025-01-31T12:34:56.789Z',...terms});
 await api('a',`/api/offers/${offerId}/approve`,{});
 await page.getByRole('button',{name:'Reload current offers and history',exact:true}).click();
 const renderedData=await api('u','/api/bootstrap'),offer=renderedData.offers.find(o=>o.id===offerId),grant=offer.equity_grant,referral=renderedData.referral_accruals.find(r=>r.offer_id===offerId);
 async function nav(name){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
 await nav('Offers');
 const offerCard=page.locator('article.entity[data-entity="'+offerId+'"]');
 assert.ok((await offerCard.innerText()).includes(grant.schedule_note));
 assert.ok((await offerCard.innerText()).includes(offer.remittances[0].amount_display));
 await nav('Equity Table');
 const grantRow=page.getByRole('row').filter({hasText:offerId});
 assert.ok((await grantRow.innerText()).includes(grant.schedule_note));
 await nav('Referrals');
 const refCard=page.locator('article.entity[data-entity="'+referral.id+'"]');
 const text=await refCard.innerText();
 for(const v of [referral.at_hire_display,referral.contingent_display,referral.retention_cliff_at,employee.name])assert.ok(text.includes(v),v);
 await page.screenshot({path:out+'/financial-referral.png',fullPage:true});
 record('normal rendered offer/equity/referral surfaces expose grant schedule, signing payment, referral recipient, halves and cliff');
'''
mutant=r'''
 await editor(p,'MUTANT-ABA');await preview();
 const extra=await hire(p.a);await api('f',`/api/offers/${extra}/rescind`,{effective_at:'2025-02-28T12:34:56.789Z'});
 await current.getByRole('button',{name:'Commit reviewed change',exact:true}).click();
 await page.getByRole('heading',{name:/MUTANT-ABA.*COMMITTED/}).waitFor();
 record('partial implementation wrongly accepts restored-balance economic history change');
 await editor(q,'MUTANT-LEAF');await preview();
 await api('f',`/api/offers/${q.x}/rescind`,{effective_at:'2025-02-28T12:34:56.789Z'});
 await current.getByRole('button',{name:'Commit reviewed change',exact:true}).click();
 await current.getByRole('alert').filter({hasText:/.+/}).waitFor();
 assert.equal(await page.getByLabel('Member 1 Signing bonus (dollars)',{exact:true}).inputValue(),'1.23');
 assert.equal(await page.getByLabel('Member 2 Equity fair value (dollars)',{exact:true}).inputValue(),'2.03');
 assert.equal(await page.getByLabel('Member 1 destination requisition',{exact:true}).inputValue(),q.b);
 await page.screenshot({path:out+'/independent-recovery.png',fullPage:true});
 const available=await page.getByLabel('Member 1 source offer',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
 const replacement=(await api('u','/api/bootstrap')).offers.find(o=>o.status==='COMMITTED'&&available.includes(o.id)&&!Object.values(q).includes(o.id));
 assert.ok(replacement);
 await page.getByLabel('Member 1 source offer',{exact:true}).selectOption(replacement.id);
 // Changing the stale source correctly loads that member's terms; the unaffected
 // second member remains entered. Correct the replacement economics if needed.
 await page.getByLabel('Member 1 Base salary (dollars)',{exact:true}).fill('10.00');
 await page.getByLabel('Member 1 Equity units',{exact:true}).fill('7');
 await page.getByLabel('Member 1 Equity fair value (dollars)',{exact:true}).fill('1.02');
 await page.getByLabel('Member 1 Equity strike price (dollars)',{exact:true}).fill('0.01');
 assert.equal(await page.getByLabel('Member 2 Equity fair value (dollars)',{exact:true}).inputValue(),'2.03');
 await page.getByLabel('Operation key',{exact:true}).fill('MUTANT-RECOVERED');await preview();
 await current.getByRole('button',{name:'Commit reviewed change',exact:true}).click();
 await page.getByRole('heading',{name:/MUTANT-RECOVERED.*COMMITTED/}).waitFor();
 record('same partial app retains editor after genuine source refusal and supports corrected successful operation');
'''
(p/'targeted-golden.cjs').write_text((prefix+golden+ending).replace("const out='/evidence/batch-ui'","const out='/evidence/targeted-golden'"))
prefix=prefix.replace("const out='/evidence/batch-ui'","const out='/evidence/partial-recovery'")
needle=" child=spawn('node',['/solution/app/server.js']"
setup=""" const mutantRoot='/tmp/hireops-partial';fs.cpSync('/solution',mutantRoot,{recursive:true});
 const f=mutantRoot+'/app/src/change-sets.js',original=fs.readFileSync(f,'utf8');
 const line=\"        if (version(r.req_id) !== r.version) reject('Stale preview: a touched requisition changed. Prepare a new operation key.', 409);\";
 assert.ok(original.includes(line));fs.writeFileSync(f,original.replace(line,'        // Deliberate diagnostic mutant: economic history comparison omitted.'));
 fs.writeFileSync(out+'/mutation.json',JSON.stringify({file:'app/src/change-sets.js',removed:line,original_sha256:crypto.createHash('sha256').update(original).digest('hex'),mutant_sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}));
 child=spawn('node',[mutantRoot+'/app/server.js']"""
assert needle in prefix
(p/'partial-recovery.cjs').write_text((prefix.replace(needle,setup)+mutant+ending).replace("kind:'Scripted golden browser evidence, not configured judge grade'","kind:'Diagnostic partial implementation browser observations; no configured grade or reward'"))
print('Created two isolated diagnostic drivers; task source unchanged.')

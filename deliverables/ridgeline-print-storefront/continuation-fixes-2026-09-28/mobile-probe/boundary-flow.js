async(page)=>{
 const result={scope:'Proposed mobile usability check on golden, not LLM grading',checks:[]};
 const check=(id,passed)=>{result.checks.push({id,passed});if(!passed)throw new Error(id);};
 async function screen(name){check(name+'_fits',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'/work/'+name+'.png',fullPage:true});}
 async function control(name,loc){await loc.scrollIntoViewIfNeeded();check(name+'_visible',await loc.isVisible());check(name+'_enabled',await loc.isEnabled());}
 await page.setViewportSize({width:390,height:844});
 await page.locator('.print-card').first().waitFor();await screen('catalogue');
 await page.getByRole('button',{name:'View Long Field',exact:true}).click();await screen('detail');
 await page.getByRole('button',{name:/^A3/}).click();await page.getByRole('button',{name:'Add to basket',exact:true}).click();
 await page.getByRole('status').filter({hasText:'added to your basket'}).waitFor();
 await page.getByRole('button',{name:/Open basket,/}).click();await screen('basket');
 await page.getByRole('button',{name:'Continue to checkout',exact:true}).click();
 for(const[name,value]of[['Full name','Mobile Visitor'],['Address line 1','10 Paper Lane'],['Town or city','York'],['Postcode','YO1 7AA']]){const field=page.getByLabel(name,{exact:true});await control(name,field);await field.fill(value);}
 await screen('delivery');await page.getByRole('button',{name:'Review order',exact:true}).click();
 await control('submit',page.getByRole('button',{name:'Place order',exact:true}));await screen('review');
 await page.getByRole('button',{name:'Track an order',exact:true}).click();await control('lookup',page.getByLabel('Order reference',{exact:true}));await screen('lookup');
 await page.getByLabel('Order reference',{exact:true}).fill('RP-100001');await page.getByRole('button',{name:'Find order',exact:true}).click();await page.getByText('RP-100001',{exact:true}).waitFor();await screen('receipt');
 await page.getByRole('button',{name:/Open basket,/}).click();while(await page.getByRole('button',{name:/^Remove /}).count())await page.getByRole('button',{name:/^Remove /}).first().click();
 check('cleanup_empty',await page.locator('.basket-line').count()===0);
 result.passed=result.checks.every(c=>c.passed);return result;
}
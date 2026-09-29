async (page) => {
 const result={scope:"Temporary browser CSS counterexample, not a complete judge run or source modification",checks:[]};
 const check=(id,passed)=>{result.checks.push({id,passed});if(!passed)throw new Error(id);};
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'View Long Field',exact:true}).click();
 await page.getByRole('button',{name:/^A3/}).click();
 await page.getByRole('button',{name:'Add to basket',exact:true}).click();
 await page.getByRole('status').filter({hasText:'added to your basket'}).waitFor();
 await page.getByRole('button',{name:/Open basket,/}).click();
 await page.getByRole('button',{name:'Continue to checkout',exact:true}).click();
 check('golden_desktop_checkout_field_visible',await page.getByLabel('Full name',{exact:true}).isVisible());
 await page.setViewportSize({width:390,height:844});
 check('golden_mobile_checkout_field_visible',await page.getByLabel('Full name',{exact:true}).isVisible());
 await page.screenshot({path:'/work/golden-mobile-checkout.png',fullPage:true});
 await page.addStyleTag({content:'@media(max-width:600px){.address-panel form{display:none!important}}'});
 check('counterexample_mobile_checkout_field_hidden',!(await page.getByLabel('Full name',{exact:true}).isVisible()));
 await page.screenshot({path:'/work/counterexample-mobile-checkout.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 check('counterexample_desktop_checkout_still_visible',await page.getByLabel('Full name',{exact:true}).isVisible());
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'The prints',exact:true}).click();
 check('counterexample_mobile_catalogue_visible',await page.locator('.print-card').first().isVisible());
 check('counterexample_mobile_catalogue_no_overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.getByRole('button',{name:/Open basket,/}).click();
 check('counterexample_mobile_basket_checkout_control_visible',await page.getByRole('button',{name:'Continue to checkout',exact:true}).isVisible());
 check('counterexample_mobile_basket_no_overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 result.passed=result.checks.every(c=>c.passed);return result;
}
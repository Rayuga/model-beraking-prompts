from pathlib import Path
ROOT = Path.cwd()
OUT = Path(__file__).resolve().parent / 'golden'
OUT.mkdir(exist_ok=True)
OLD = ROOT / 'deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/golden'
source = (OLD / 'boundary-flow.js').read_text(encoding='utf-8')
old_cancel = "async function cancel(p=page){await p.getByRole('button',{name:'Cancel order',exact:true}).click();await p.getByRole('alertdialog').waitFor();await p.getByRole('button',{name:'Confirm cancellation',exact:true}).click();await p.getByRole('heading',{name:'Order cancelled.',exact:true}).waitFor();}"
new_cancel = """async function cancel(p=page){
    async function activate(name){for(let i=0;i<80;i++){await p.keyboard.press('Tab');if(await p.evaluate(n=>document.activeElement.tagName==='BUTTON'&&document.activeElement.textContent.trim()===n,name)){await p.keyboard.press('Enter');return;}}throw new Error('keyboard cancellation control unreachable: '+name);}
    await activate('Cancel order');await p.getByRole('alertdialog').waitFor();await activate('Confirm cancellation');await p.getByRole('heading',{name:'Order cancelled.',exact:true}).waitFor();
  }"""
assert old_cancel in source
source=source.replace(old_cancel,new_cancel)
addition = r'''
    await check('all_shop_controls_have_keyboard_focus',async()=>{
      const before=await stocks(),surfaces=[];
      async function inspect(surface){
        const selector='button,a[href],input,select,textarea';
        const expected=await page.locator(selector).evaluateAll(es=>es.map((e,index)=>({index,tag:e.tagName,type:e.type,name:e.getAttribute('aria-label')||[...(e.labels||[])].map(l=>l.textContent.trim()).join(' ')||e.textContent.trim(),visible:!!(e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true'})).filter(e=>e.visible&&!e.disabled&&e.type!=='hidden'));
        require(expected.every(e=>e.name),'all visible controls labelled '+surface);
        const seen=new Map();
        for(let i=0;i<expected.length*3+5;i++){
          await page.keyboard.press('Tab');
          const e=await page.evaluate(sel=>{const el=document.activeElement;const css=getComputedStyle(el);return{index:[...document.querySelectorAll(sel)].indexOf(el),visibleFocus:el.matches(':focus-visible'),outline:css.outlineStyle,width:css.outlineWidth};},selector);
          if(e.index>=0)seen.set(e.index,e);
          if(expected.every(e=>seen.has(e.index)))break;
        }
        const missing=expected.filter(e=>!seen.has(e.index));
        require(!missing.length,'keyboard unreachable on '+surface+': '+JSON.stringify(missing));
        require(expected.every(e=>seen.get(e.index).visibleFocus&&seen.get(e.index).outline!=='none'&&parseFloat(seen.get(e.index).width)>0),'visible focus '+surface);
        surfaces.push({surface,controls:expected,observedFocus:[...seen.values()]});
      }
      await grid();await inspect('catalogue');
      await add('RP-108','A2',1);await inspect('product size quantity add and return');
      await page.getByRole('button',{name:/Open basket,/}).click();await summary([6450,0,320,6770]);await inspect('basket quantity remove checkout');
      await page.getByRole('button',{name:'Continue to checkout',exact:true}).click();
      for(const[label,value]of[['Full name','Keyboard Review'],['Address line 1','82 Paper Street'],['Town or city','York'],['Postcode','YO1 7AA']])await page.getByLabel(label,{exact:true}).fill(value);
      await inspect('delivery fields and review');
      await page.getByRole('button',{name:'Review order',exact:true}).click();await inspect('final review and unactivated submit');
      await page.getByRole('button',{name:'Track an order',exact:true}).click();await inspect('reference lookup');
      await lookup(page,'RP-100001');await inspect('historical receipt return');
      await clear();equal(await stocks(),before,'keyboard inspection creates no order and changes no stock');
      return{surfaces,allReachable:true,allLabelled:true,noDurableMutation:true};
    });
'''
needle="    await check('basket_invalid_edit_reload_and_zero_independent_context'"
assert source.count(needle)==1
source=source.replace(needle, addition+'\n'+needle)
(OUT / 'boundary-flow.js').write_text(source, encoding='utf-8')
(OUT / 'run_mcp.py').write_bytes((OLD / 'run_mcp.py').read_bytes())
print(OUT)

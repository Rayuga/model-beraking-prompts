const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const phase = process.argv[2];
const snapshotPath = '/logs/verifier/local-persistence-before.json';
const base = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
  const page = await context.newPage();
  const checks = [];
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  let catalogueURL;
  async function read(url) {
    const result = await page.evaluate(async url => {
      const response = await fetch(url, {cache:'no-store'});
      return {status:response.status,body:await response.json()};
    }, url);
    assert.equal(result.status,200);
    return result.body;
  }
  async function catalogue() {
    const value = await read(catalogueURL);
    const prints = value.prints;
    const keys = prints.flatMap(p => p.sizes.map(s => `${p.sku}/${s.size}`));
    assert.equal(prints.length,8);
    assert.equal(new Set(prints.map(p=>p.sku)).size,8);
    assert.equal(keys.length,13);
    assert.equal(new Set(keys).size,13);
    return {identities:keys.sort(),stocks:Object.fromEntries(prints.flatMap(p=>p.sizes.map(s=>[`${p.sku}/${s.size}`,s.in_stock])))};
  }
  async function operation(response) {
    const request = response.request();
    const headers = await request.allHeaders();
    return {url:request.url(),method:request.method(),headers:headers['content-type']?{'content-type':headers['content-type']}:{},body:request.postData()};
  }
  async function replay(op) {
    const response = await page.evaluate(async op => {
      const response = await fetch(op.url, {method:op.method,headers:op.headers,...(op.body?{body:op.body}:{})});
      return {status:response.status,body:await response.json()};
    },op);
    assert(response.status>=200 && response.status<300,JSON.stringify(response));
    return response.body;
  }
  async function lookup(reference) {
    await page.getByRole('button',{name:'Track an order',exact:true}).click();
    await page.getByLabel('Order reference',{exact:true}).fill(reference);
    const responsePromise = page.waitForResponse(r=>r.request().method()==='GET' && r.url().includes(reference));
    await page.getByRole('button',{name:'Find order',exact:true}).click();
    const response = await responsePromise;
    assert.equal(response.status(),200);
    const order = await response.json();
    await page.getByText(reference,{exact:true}).waitFor();
    return order;
  }
  async function assertKiln(order,name,status) {
    assert.equal(order.status,status);
    assert.equal(order.address_name,name);
    assert.equal(order.total_pence,3970);
    assert.equal(order.subtotal_pence,3795);
    assert.equal(order.postage_pence,175);
    assert.equal(order.trade_saving_pence,0);
    assert.equal(order.lines.length,1);
    assert.equal(order.lines[0].title,'Kiln');
    assert.equal(order.lines[0].size,'A3');
    assert.equal(order.lines[0].qty,1);
    assert.match(await page.locator('.receipt-address').innerText(),new RegExp(name));
    assert.match(await page.locator('.receipt-lines').innerText(),/Kiln/);
    assert.match(await page.locator('.summary-total').innerText(),/39\.70/);
  }
  async function buy(name) {
    await page.getByRole('button',{name:'The prints',exact:true}).click();
    await page.getByRole('button',{name:'View Kiln',exact:true}).click();
    await page.getByRole('button',{name:/^A3/}).click();
    await page.getByRole('button',{name:'Add to basket',exact:true}).click();
    await page.getByRole('button',{name:'View basket',exact:false}).click();
    await page.getByRole('button',{name:'Continue to checkout',exact:true}).click();
    for(const [label,value] of Object.entries({'Full name':name,'Address line 1':'27 Paper Street','Town or city':'Leeds','Postcode':'LS1 1AA'})) {
      await page.getByLabel(label,{exact:true}).fill(value);
    }
    await page.getByRole('button',{name:'Review order',exact:true}).click();
    const responsePromise = page.waitForResponse(r=>r.request().method()==='POST' && r.request().postData()?.includes(name));
    await page.getByRole('button',{name:'Place order',exact:true}).click();
    const response = await responsePromise;
    assert.equal(response.status(),201);
    const order = await response.json();
    await page.getByText(order.reference,{exact:true}).waitFor();
    await assertKiln(order,name,'placed');
    return {order,operation:await operation(response),name};
  }
  try {
    const cataloguePromise = page.waitForResponse(r=>r.request().method()==='GET' && r.url().endsWith('/api/prints'));
    await page.goto(base);
    catalogueURL = (await cataloguePromise).url();
    const starting = await catalogue();
    let evidence;
    if(phase==='prepare') {
      const cancelled = await buy('Restart Cancelled Buyer');
      const kilnKey = `${cancelled.order.lines[0].sku}/A3`;
      const S = starting.stocks[kilnKey];
      assert(S>=1);
      assert.equal((await catalogue()).stocks[kilnKey],S-1);
      await page.getByRole('button',{name:'Cancel order',exact:true}).click();
      const responsePromise = page.waitForResponse(r=>r.request().method()==='POST' && r.url().includes(cancelled.order.reference));
      await page.getByRole('button',{name:'Confirm cancellation',exact:true}).click();
      const response = await responsePromise;
      assert.equal(response.status(),200);
      cancelled.cancellation = await operation(response);
      cancelled.order = await response.json();
      await page.getByRole('heading',{name:'Order cancelled.',exact:true}).waitFor();
      await assertKiln(cancelled.order,cancelled.name,'cancelled');
      assert.equal((await catalogue()).stocks[kilnKey],S);
      const placed = await buy('Restart Placed Buyer');
      assert.notEqual(placed.order.reference,cancelled.order.reference);
      assert.notDeepEqual(placed.operation.body,cancelled.operation.body);
      assert.equal((await catalogue()).stocks[kilnKey],S-1);
      assert.deepEqual(await lookup(cancelled.order.reference),cancelled.order);
      assert.deepEqual(await lookup(placed.order.reference),placed.order);
      const historical = await lookup('RP-100001');
      assert.equal(historical.status,'dispatched');
      assert.equal(historical.total_pence,7320);
      assert.equal(historical.lines[0].qty,2);
      assert.equal(historical.lines[0].unit_price_pence,3500);
      evidence = {cancelled,placed,historical,kilnKey,S,catalogue:await catalogue()};
      fs.writeFileSync(snapshotPath,JSON.stringify(evidence,null,2));
      checks.push('UI one-unit purchase and cancellation return stock to S',
                  'Separate UI placed order leaves stock at S minus one',
                  'Both full receipts, every variant stock and identities recorded before restart');
    } else {
      const before = JSON.parse(fs.readFileSync(snapshotPath));
      assert.deepEqual(starting,before.catalogue);
      const cancelled = await lookup(before.cancelled.order.reference);
      assert.deepEqual(cancelled,before.cancelled.order);
      await assertKiln(cancelled,before.cancelled.name,'cancelled');
      const placed = await lookup(before.placed.order.reference);
      assert.deepEqual(placed,before.placed.order);
      await assertKiln(placed,before.placed.name,'placed');
      checks.push('Fresh browser retrieves exact cancelled and placed receipts and addresses after process restart');
      assert.deepEqual(await replay(before.cancelled.operation),before.cancelled.order);
      assert.deepEqual(await replay(before.placed.operation),before.placed.order);
      assert.deepEqual(await replay(before.cancelled.cancellation),before.cancelled.order);
      assert.deepEqual(await catalogue(),before.catalogue);
      checks.push('Original checkout retries preserve each reference and terminal status without stock mutation',
                  'Repeated cancellation does not restore stock again');
      assert.deepEqual(await lookup('RP-100001'),before.historical);
      assert.deepEqual(await lookup(before.cancelled.order.reference),before.cancelled.order);
      assert.deepEqual(await lookup(before.placed.order.reference),before.placed.order);
      assert.deepEqual(await catalogue(),before.catalogue);
      checks.push('Eight print identities and thirteen variant identities/stocks remain unchanged',
                  'Historical dispatched receipt remains exact at GBP 73.20');
      evidence = {cancelled,placed,historical:before.historical,catalogue:await catalogue()};
    }
    assert.deepEqual(browserErrors,[]);
    console.log(JSON.stringify({phase,passed:true,browser:browser.version(),checks,evidence,browserErrors}));
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

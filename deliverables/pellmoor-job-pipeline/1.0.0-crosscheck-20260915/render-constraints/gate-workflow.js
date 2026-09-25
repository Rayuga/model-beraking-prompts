async (page) => {
  const results = [];
  const errors = [];
  const timeout = 10000;
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  const observe = async (name, callback) => {
    const details = await callback();
    results.push({name, passed: true, details});
    return details;
  };
  page.on('pageerror', error => errors.push({context: 'primary', error: String(error)}));
  let anonymousContext;
  try {
    await page.setViewportSize({width: 1280, height: 800});
    await observe('public sign-in and visible controls', async () => {
      await page.locator('#email').waitFor({state: 'visible', timeout});
      await page.locator('#email').fill('hiring@pellmoor.test', {timeout});
      require(await page.locator('#password').isVisible(), 'Password control missing');
      require(await page.locator('#signin button').isVisible(), 'Sign-in button missing');
      require(await page.locator('#app').isHidden(), 'Protected workspace exposed before login');
      await page.screenshot({path: '/evidence/signin-initial.png'});
      return {url: page.url(), protected_workspace_hidden: true};
    });
    await observe('public entry survives full reload', async () => {
      await page.reload({waitUntil: 'networkidle', timeout});
      await page.locator('#email').waitFor({state: 'visible', timeout});
      require(page.url() === 'http://localhost:3000/', 'Root navigated off local entry');
      return {url: page.url(), email_visible: true, password_visible: await page.locator('#password').isVisible()};
    });
    await observe('public empty-password control responds', async () => {
      await page.locator('#password').fill('', {timeout});
      const pending = page.waitForResponse(response => response.request().method() === 'POST', {timeout});
      await page.locator('#signin button').click({timeout});
      const response = await pending;
      const body = await response.json();
      require(response.status() === 401, 'Empty-password response was not rejected');
      require(await page.locator('#email').isVisible(), 'Sign-in interface disappeared after refusal');
      await page.locator('#toast.show').waitFor({state: 'visible', timeout});
      await page.screenshot({path: '/evidence/signin-empty-password.png'});
      return {status: response.status(), body, message: await page.locator('#toast').textContent(), usable_afterward: await page.locator('#signin button').isEnabled()};
    });
    let token;
    await observe('valid UI sign-in returns a server session and populated workspace', async () => {
      await page.locator('#email').fill('hiring@pellmoor.test', {timeout});
      await page.locator('#password').fill('password123', {timeout});
      const pending = page.waitForResponse(response => response.request().method() === 'POST', {timeout});
      await page.locator('#signin button').click({timeout});
      const response = await pending;
      const body = await response.json();
      token = body.token;
      require(response.ok() && typeof token === 'string' && token.length > 16, 'No real server session returned');
      await page.locator('#roles button').first().waitFor({state: 'visible', timeout});
      await page.locator('#board .cand').first().waitFor({state: 'visible', timeout});
      const identity = await page.locator('#whoami').textContent();
      require(identity.includes('Ruth'), 'Wrong signed-in identity');
      return {status: response.status(), genuine_server_token: true, identity, visible_vacancies: await page.locator('#roles button').count(), visible_candidates: await page.locator('#board .cand').count()};
    });
    let protectedUrl;
    let protectedMethod;
    let protectedBody;
    await observe('visible vacancy uses the genuine bearer token', async () => {
      const pending = page.waitForResponse(response => response.request().method() === 'GET' && Boolean(response.request().headers().authorization), {timeout});
      await page.locator('#roles button').first().click({timeout});
      const response = await pending;
      protectedUrl = response.url();
      protectedMethod = response.request().method();
      protectedBody = await response.json();
      require(response.ok() && Array.isArray(protectedBody.candidates) && protectedBody.candidates.length > 0, 'Protected vacancy response lacks candidates');
      require(response.request().headers().authorization === 'Bearer ' + token, 'Displayed protected read did not use the issued bearer');
      require(protectedUrl.startsWith('http://localhost:3000/'), 'Hiring data was not local');
      return {url: protectedUrl, method: protectedMethod, status: response.status(), issued_token_matches_request: true, candidate_ids: protectedBody.candidates.map(candidate => candidate.id)};
    });
    await observe('candidate opens from the live workspace', async () => {
      const pending = page.waitForResponse(response => response.request().method() === 'GET' && Boolean(response.request().headers().authorization), {timeout});
      await page.locator('#board .cand').first().click({timeout});
      const response = await pending;
      await page.locator('#panel h2').waitFor({state: 'visible', timeout});
      require(response.ok(), 'Candidate read failed');
      await page.screenshot({path: '/evidence/authenticated-candidate.png'});
      return {status: response.status(), candidate_title: await page.locator('#panel h2').textContent(), url: page.url()};
    });
    anonymousContext = await page.context().browser().newContext({viewport: {width: 1280, height: 800}});
    const anonymous = await anonymousContext.newPage();
    anonymous.on('pageerror', error => errors.push({context: 'anonymous', error: String(error)}));
    await anonymous.goto('http://localhost:3000', {waitUntil: 'networkidle', timeout});
    const anonymousRead = async () => anonymous.evaluate(async ({url, method}) => {
      const response = await fetch(url, {method, credentials: 'include'});
      return {status: response.status, text: await response.text(), keys: Object.keys(localStorage)};
    }, {url: protectedUrl, method: protectedMethod});
    const verifyRefusal = result => {
      require(result.status >= 400 && result.status < 500, 'Anonymous protected read was not refused');
      require(!protectedBody.candidates.some(candidate => result.text.includes(candidate.id) || result.text.includes(candidate.name)), 'Protected candidate data leaked in refusal');
      require(!result.text.includes(protectedBody.role.code), 'Protected vacancy data leaked in refusal');
      require(!result.keys.some(key => /session|token/i.test(key)), 'Anonymous context has stored auth credentials');
    };
    await observe('fresh anonymous read before wrong-password attempt', async () => {
      require(await anonymous.locator('#app').isHidden(), 'Fresh anonymous workspace exposed');
      const result = await anonymousRead();
      verifyRefusal(result);
      return result;
    });
    await observe('exact wrong-password UI attempt refuses access', async () => {
      await anonymous.locator('#email').fill('hiring@pellmoor.test', {timeout});
      await anonymous.locator('#password').fill('Wrong-Pellmoor-123', {timeout});
      const pending = anonymous.waitForResponse(response => response.request().method() === 'POST', {timeout});
      await anonymous.locator('#signin button').click({timeout});
      const response = await pending;
      const body = await response.json();
      require(response.status() === 401 && !body.token, 'Wrong password received an authenticated session');
      require(await anonymous.locator('#app').isHidden(), 'Wrong password exposed workspace');
      await anonymous.locator('#toast.show').waitFor({state: 'visible', timeout});
      await anonymous.screenshot({path: '/evidence/signin-wrong-password.png'});
      return {status: response.status(), body, message: await anonymous.locator('#toast').textContent(), auth_cookies: (await anonymousContext.cookies()).length};
    });
    await observe('same anonymous context read after wrong-password attempt', async () => {
      const result = await anonymousRead();
      verifyRefusal(result);
      require(await anonymous.locator('#app').isHidden(), 'Anonymous workspace exposed after protected read');
      return {...result, no_credentials_copied_or_cleared: true};
    });
    await anonymousContext.close();
    anonymousContext = null;
    await observe('valid session and working workspace survive full reload', async () => {
      await page.reload({waitUntil: 'networkidle', timeout});
      await page.locator('#board .cand').first().waitFor({state: 'visible', timeout});
      require((await page.locator('#whoami').textContent()).includes('Ruth'), 'Valid session was damaged by negative controls');
      await page.locator('#board .cand').first().click({timeout});
      await page.locator('#panel h2').waitFor({state: 'visible', timeout});
      await page.screenshot({path: '/evidence/authenticated-reload.png'});
      return {url: page.url(), identity: await page.locator('#whoami').textContent(), candidate_title: await page.locator('#panel h2').textContent()};
    });
    require(errors.length === 0, 'Uncaught browser errors observed');
    return {passed: true, checks: results, page_errors: errors, unexpected_assumptions: []};
  } catch (error) {
    return {passed: false, checks: results, error: String(error), page_errors: errors};
  } finally {
    if (anonymousContext) await anonymousContext.close();
  }
}

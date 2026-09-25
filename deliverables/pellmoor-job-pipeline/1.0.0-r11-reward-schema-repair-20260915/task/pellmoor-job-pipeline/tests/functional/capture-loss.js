async function captureCommittedLoss(page, options) {
  const timeout = options.timeoutMs || 15000;
  const result = {requests: [], pending: null, setup_error: null};
  let release;
  let observed;
  const held = new Promise(resolve => { release = resolve; });
  const captured = new Promise(resolve => { observed = resolve; });
  const handlers = [];
  const match = url => url.href === options.url;
  const handler = async route => {
    if (route.request().method() !== options.method) return route.continue();
    let done;
    handlers.push(new Promise(resolve => { done = resolve; }));
    const request = route.request();
    const requestHeaders = Object.fromEntries(Object.entries(request.headers()).filter(([name]) => !['authorization', 'cookie'].includes(name.toLowerCase())));
    const entry = {method: request.method(), url: request.url(), request_headers: requestHeaders, request_body: request.postData()};
    result.requests.push(entry);
    try {
      const response = await route.fetch({timeout, maxRetries: 0});
      entry.status = response.status();
      entry.response_body = await response.text();
      entry.response_json = JSON.parse(entry.response_body);
      observed();
      await held;
    } catch (error) {
      result.setup_error = String(error);
      observed();
    } finally {
      try { await route.abort('failed'); }
      catch (error) { result.setup_error = result.setup_error || String(error); }
      done();
    }
  };
  await page.route(match, handler);
  try {
    const requested = page.waitForRequest(request => request.url() === options.url && request.method() === options.method, {timeout});
    await Promise.all([options.activate(), requested]);
    await captured;
    if (!result.setup_error) {
      result.pending = await options.observePending();
      await options.activateAgain();
      await page.waitForTimeout(250);
      result.requests_while_pending = result.requests.length;
    }
  } catch (error) {
    result.setup_error = String(error);
  } finally {
    release();
    try { await Promise.all(handlers); }
    catch (error) { result.setup_error = result.setup_error || String(error); }
    await page.unroute(match, handler);
  }
  return result;
}

if (typeof module !== 'undefined') module.exports = {captureCommittedLoss};

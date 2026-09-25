async function preservePrimarySession(page, options) {
  const timeout = options.timeoutMs || 10000;
  const primaryContext = page.context();
  const browser = primaryContext.browser();
  const initialUrl = page.url();
  let preservedUrl = initialUrl;
  const result = {prepared: null, secondary: null, completed: null, before: null, after: null, setup_error: null, diagnostics: {events: [], counts_before: null, counts_after: null}};
  const listeners = [];
  let secondaryContext;
  let phase = 'initial observation';
  function listen(target, event, handler) {
    target.on(event, handler);
    listeners.push([target, event, handler]);
  }
  function record(event, detail) {
    result.diagnostics.events.push({phase, event, detail});
  }
  function location(url) {
    return typeof url === 'string' ? url.split(/[?#]/, 1)[0].replace(/\/\/[^/]*@/, '//[redacted]@') : '[unavailable URL]';
  }
  function counts() {
    const contexts = browser ? browser.contexts() : [primaryContext];
    return {contexts: contexts.length, pages: contexts.reduce((total, context) => total + context.pages().length, 0)};
  }
  function primaryStatus() {
    return {closed: page.isClosed(), same_url: !page.isClosed() && page.url() === preservedUrl, location: location(page.url())};
  }
  function requirePrimary(unchangedUrl = true) {
    const status = primaryStatus();
    if (status.closed || (unchangedUrl && !status.same_url) || result.diagnostics.events.some(event => event.event === 'primary-crash')) {
      throw new Error('Primary page changed, closed or crashed during the preserved-session workflow');
    }
  }
  listen(page, 'crash', () => record('primary-crash', null));
  listen(page, 'close', () => record('primary-close', null));
  listen(primaryContext, 'close', () => record('primary-context-close', null));
  listen(page, 'pageerror', error => record('primary-pageerror', String(error)));
  listen(page, 'requestfailed', request => record('primary-requestfailed', {url: location(request.url()), method: request.method(), error: request.failure()?.errorText || null}));
  try {
    if (!browser) throw new Error('Independent browser context is unavailable');
    if (![options.preparePrimary, options.actSecondary, options.resumePrimary, options.observePrimary].every(callback => typeof callback === 'function')) {
      throw new Error('All four observed-UI callbacks are required');
    }
    result.diagnostics.counts_before = counts();
    result.diagnostics.initial_location = location(initialUrl);
    requirePrimary(false);
    result.before = await options.observePrimary(page, timeout);
    phase = 'prepare primary';
    let checkpointSaved = false;
    const prepared = await options.preparePrimary(page, timeout, capture => {
      if (checkpointSaved) throw new Error('The original prepared checkpoint has already been saved');
      result.prepared = capture;
      checkpointSaved = true;
    });
    if (!checkpointSaved) result.prepared = prepared;
    requirePrimary(false);
    preservedUrl = page.url();
    result.diagnostics.prepared_location = location(preservedUrl);
    phase = 'secondary action';
    secondaryContext = await browser.newContext({viewport: page.viewportSize() || {width: 1280, height: 800}});
    secondaryContext.setDefaultTimeout(timeout);
    secondaryContext.setDefaultNavigationTimeout(timeout);
    const secondaryPage = await secondaryContext.newPage();
    listen(secondaryPage, 'crash', () => record('secondary-crash', null));
    listen(secondaryPage, 'pageerror', error => record('secondary-pageerror', String(error)));
    result.secondary = await options.actSecondary(secondaryPage, timeout);
    phase = 'return to primary';
    await secondaryContext.close();
    secondaryContext = null;
    requirePrimary();
    await page.bringToFront();
    phase = 'resume primary';
    result.completed = await options.resumePrimary(page, timeout);
  } catch (error) {
    result.setup_error = {phase, message: String(error)};
  } finally {
    if (secondaryContext) {
      try { await secondaryContext.close(); }
      catch (error) { record('secondary-cleanup-error', String(error)); }
    }
    phase = 'final observation';
    result.diagnostics.primary = primaryStatus();
    if (!page.isClosed() && typeof options.observePrimary === 'function') {
      try { result.after = await options.observePrimary(page, timeout); }
      catch (error) { record('final-observation-error', String(error)); }
    }
    try { result.diagnostics.counts_after = counts(); }
    catch (error) { record('context-inventory-error', String(error)); }
    for (const [target, event, handler] of listeners) target.removeListener(event, handler);
  }
  return result;
}

if (typeof module !== 'undefined') module.exports = {preservePrimarySession};

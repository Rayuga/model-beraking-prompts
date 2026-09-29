'use strict';

// Disposable browser proof only. Importing this module performs no IO.
// Candidate responses are never read as text/JSON/bytes and downloads are never opened.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const CANDIDATES = Object.freeze(['/app.db', '/app.db-wal', '/app.db-shm', '/server.js', '/package.json', '/package-lock.json', '/npm-shrinkwrap.json', '/.git/config', '/.git/HEAD']);
const VARIANTS = Object.freeze(['golden', 'public-server-script']);
const PUBLIC_MARKER = 'S06 disposable public browser asset is active';
const PUBLIC_SCRIPT = `(() => { const out = document.createElement('output'); out.id = 's06-public-asset'; out.textContent = ${JSON.stringify(PUBLIC_MARKER)}; out.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:6px;background:white;color:black;font:12px sans-serif'; document.body.appendChild(out); })();`;
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const successful = status => Number.isInteger(status) && status >= 200 && status < 300;

// Exactly one classification is returned. A prior request is provenance evidence,
// not by itself an intended public role or a privacy failure.
function classifyCandidate(row) {
  if (row.denial) return {outcome:'denial', product_pass:true, observed_product_defect:false};
  if (row.no_content) return {outcome:'no_content', product_pass:true, observed_product_defect:false};
  if (row.working_workspace) return {outcome:'working_workspace', product_pass:true, observed_product_defect:false};
  if (row.reproducible_refusal && row.healthy_after_refusal) return {outcome:'denial', product_pass:true, observed_product_defect:false};
  if (row.established_public_role) return {outcome:'intended_public_role', product_pass:true, observed_product_defect:false};
  if (row.observation_unavailable) return {outcome:'incomplete', product_pass:null, observed_product_defect:false, reason:row.observation_unavailable};
  const standalone = successful(row.status) || Boolean(row.download_events?.length);
  const purpose = row.legitimate_public_purpose, clarification = row.bounded_clarification;
  if (standalone && purpose?.concrete_affirmative === true && purpose.exact_evidence && clarification?.attempts === 1 && clarification.unresolved === true && clarification.missing_observation) return {outcome:'incomplete', product_pass:null, observed_product_defect:false, reason:'EVALUATION_INCOMPLETE: Concrete evidence of legitimate public purpose remains unresolved after one bounded ordinary-feature clarification.', exact_evidence:purpose.exact_evidence, missing_observation:clarification.missing_observation};
  if (standalone) return {outcome:'exposure', product_pass:false, observed_product_defect:true};
  return {outcome:'incomplete', product_pass:null, observed_product_defect:false, reason:'No established denial, usable fallback, public role, or successful standalone delivery was observable.'};
}

// Pure classification examples, not browser observations or application evidence.
// The narrow ambiguity input explicitly contains both prerequisites; a generic
// ordinary request by itself remains an exposure when standalone delivery succeeds.
const CLASSIFIER_CASES = Object.freeze([
  {id:'denial_over_download',input:{status:403,denial:true,download_events:[{}]},expected:'denial'},
  {id:'working_fallback',input:{status:200,working_workspace:true,download_events:[]},expected:'working_workspace'},
  {id:'established_public_browser_asset',input:{status:200,established_public_role:{role:'Browser script with actual rendered UI effect'},download_events:[]},expected:'intended_public_role'},
  {id:'successful_standalone_without_role',input:{status:200,download_events:[]},expected:'exposure'},
  {id:'generic_normal_fetch_is_not_role_evidence',input:{status:200,ordinary_requests_before_probe:[{resource_type:'fetch'}],download_events:[]},expected:'exposure'},
  {id:'narrow_ambiguity_after_one_clarification',input:{status:200,download_events:[],legitimate_public_purpose:{concrete_affirmative:true,exact_evidence:'HYPOTHETICAL MATRIX INPUT: normal feature use has concrete affirmative evidence of a legitimate public purpose.'},bounded_clarification:{attempts:1,unresolved:true,missing_observation:'HYPOTHETICAL MATRIX INPUT: the permitted same-feature observation could not resolve the requested resource role.'}},expected:'incomplete'},
  {id:'real_tool_unavailability',input:{status:null,download_events:[],observation_unavailable:'HYPOTHETICAL MATRIX INPUT: browser observation crashed.'},expected:'incomplete'},
]);

function overallOutcome(rows, controls) {
  if (rows.some(row => row.classification.outcome === 'exposure')) return {status:'observed exposure', product_pass:false, observed_product_defect:true};
  if (!controls.initial.succeeded || !controls.recovery.succeeded || rows.some(row => row.classification.outcome === 'incomplete')) return {status:'incomplete', product_pass:null, observed_product_defect:false};
  return {status:'observed pass', product_pass:true, observed_product_defect:false};
}

async function runS06Observer({page, GoldenBrowser, ledger, url, variant = 'golden', freezeBinding}) {
  assert(VARIANTS.includes(variant), 'Unknown disposable S06 variant');
  assert(freezeBinding?.confirmed === true, 'Execution requires a confirmed final fixture freeze');
  assert(/^[a-f0-9]{64}$/i.test(freezeBinding.prompt_sha256 ?? '') && /^[a-f0-9]{64}$/i.test(freezeBinding.judge_sha256 ?? ''), 'Exact final prompt and judge hashes required');
  assert(page.url() === 'about:blank', 'Use a fresh page in a dedicated disposable context');
  const rootURL = new URL(url).toString(), assetURL = new URL('/server.js', rootURL).toString(), context = page.context();
  const d = new GoldenBrowser(page, ledger, rootURL);
  d.stopListDiscovery();
  const at = () => ledger.relative();
  const provenance = [], consoleDiagnostics = [], injection = {variant, workspace_document_rewrites:0, candidate_deliveries:[], candidate_body_inspected:false,public_script_sha256:variant === 'public-server-script' ? sha256(PUBLIC_SCRIPT) : null};
  let beforeProbes = true;
  const requestListener = request => {
    if (!beforeProbes || request.isNavigationRequest()) return;
    const candidate = CANDIDATES.find(path => new URL(path, rootURL).toString() === request.url());
    if (candidate) provenance.push({candidate,url:request.url(),method:request.method(),resource_type:request.resourceType(),ordinary_workspace_use:true,at_ms:at()});
  };
  page.on('request', requestListener);
  const consoleListener = message => consoleDiagnostics.push({type:message.type(),text:message.text(),at_ms:at()});
  page.on('console', consoleListener);

  const assetHandler = async route => {
    const request = route.request();
    injection.candidate_deliveries.push({url:request.url(),resource_type:request.resourceType(),navigation:request.isNavigationRequest(),before_privacy_probes:beforeProbes,at_ms:at()});
    await route.fulfill({status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'},body:PUBLIC_SCRIPT});
  };
  if (variant !== 'golden') {
    assert(!CANDIDATES.some(path => new URL(path, rootURL).toString() === rootURL), 'Workspace overlay URL must not itself be a candidate');
    await context.route(assetURL, assetHandler);
    injection.method = 'Main-page initialization script adds public script element at DOMContentLoaded; original document response is unchanged.';
    injection.added_markup = '<script src="/server.js" data-s06-proof="public-browser-asset"></script>';
    await page.addInitScript(({rootURL}) => {
      if (window !== window.top || location.href !== rootURL) return;
      const install = () => {
        const script = document.createElement('script');script.src = '/server.js';script.dataset.s06Proof = 'public-browser-asset';document.body.appendChild(script);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});else install();
    }, {rootURL});
  }

  const control = async (driver, marker) => {
    try {
      await driver.disableAutoIfAvailable();
      await driver.run(`document.body.textContent='${marker}';console.log('${marker}-log');`, 'privacy-control.js');
      const body = await driver.body(), logs = await driver.logs(), status = await driver.status();
      return {succeeded:body === marker && logs.includes(marker + '-log'),marker,body,log_marker_observed:logs.includes(marker + '-log'),status};
    } catch (error) {
      // These diagnostics read only the known working UI and its authored preview,
      // never a candidate's standalone response. Keep failure diagnostics bounded.
      const observed = await Promise.allSettled([
        driver.page.getByRole('status').innerText({timeout:1200}),
        driver.page.getByRole('log').innerText({timeout:1200}),
        driver.preview().locator('body').innerText({timeout:1200}),
      ]);
      const diagnostic = Object.fromEntries(['status','logs','preview_body'].map((key,index) => [key,observed[index].status === 'fulfilled' ? observed[index].value : {unavailable:String(observed[index].reason)}]));
      return {succeeded:false,marker,error:String(error),diagnostic,browser_console:[...consoleDiagnostics]};
    }
  };

  const probeOnce = async (candidate, attempt) => {
    const probe = await context.newPage(), downloads = [], responses = [];
    let crashed = false, error = null, working = null;
    probe.on('crash', () => { crashed = true; });
    probe.on('download', download => downloads.push({suggested_filename:download.suggestedFilename(),at_ms:at()}));
    probe.on('response', response => {
      const request = response.request();
      if (!request.isNavigationRequest() || request.frame() !== probe.mainFrame()) return;
      const headers = response.headers();
      responses.push({status:response.status(),url:response.url(),headers:{content_type:headers['content-type'] ?? null,content_disposition:headers['content-disposition'] ?? null},at_ms:at()});
    });
    try {
      try { await ledger.action('privacy_navigation', `S06 ${candidate}, attempt ${attempt}`, () => probe.goto(new URL(candidate, rootURL).toString(), {timeout:8000,waitUntil:'domcontentloaded'})); }
      catch (caught) { error = String(caught); }
      const final = responses.at(-1) ?? {status:null,url:probe.url(),headers:{content_type:null,content_disposition:null}};
      const denial = [401,403,404,410].includes(final.status), noContent = [204,205].includes(final.status);
      if (!denial && !noContent && !downloads.length && !crashed && !probe.isClosed()) {
        // Presence checks inspect only rendered workspace controls, never standalone text.
        const editor = probe.getByRole('textbox', {name:'Code editor',exact:true});
        try { await editor.waitFor({state:'visible',timeout:1500}); } catch {}
        if (await editor.count() && await probe.getByRole('log').count() && await probe.locator('iframe[title="Live preview"]').count()) {
          const fallback = new GoldenBrowser(probe, ledger, rootURL);fallback.stopListDiscovery();
          working = await control(fallback, `s06-fallback-${CANDIDATES.indexOf(candidate)}-${attempt}`);
        }
      }
      return {...final,attempt,navigation_error:error,download_events:downloads,denial,no_content:noContent,working_workspace:Boolean(working?.succeeded),workspace_control:working,crashed,response_metadata:responses};
    } finally { if (!probe.isClosed()) await probe.close(); }
  };

  try {
    let openError = null;
    try { await d.open(); } catch (error) { openError = String(error); }
    const initial = openError ? {succeeded:false,error:openError} : await control(d, 's06-healthy-control');
    let visiblePublicMarker = false;
    if (variant === 'public-server-script') {
      try { await page.locator('#s06-public-asset').waitFor({state:'visible',timeout:3000});visiblePublicMarker = await page.locator('#s06-public-asset').innerText() === PUBLIC_MARKER; } catch {}
    }
    beforeProbes = false;
    const prior = [...provenance], rows = [];
    for (const candidate of CANDIDATES) {
      const ordinaryRequests = prior.filter(row => row.candidate === candidate);
      const publicRole = candidate === '/server.js' && visiblePublicMarker && ordinaryRequests.some(row => row.resource_type === 'script')
        ? {role:'Public browser script with an observed visible UI effect',request:ordinaryRequests.find(row => row.resource_type === 'script'),visible_marker:PUBLIC_MARKER,disposable_variant:true}
        : null;
      const attempts = [await probeOnce(candidate, 1)];
      const first = attempts[0];
      const deliberateRefusal = result => result.status === null && !result.crashed && /net::ERR_(?:BLOCKED_BY_CLIENT|BLOCKED_BY_RESPONSE|ACCESS_DENIED|CONNECTION_CLOSED|CONNECTION_RESET|EMPTY_RESPONSE)/.test(result.navigation_error ?? '');
      let refusalControl = null;
      if (deliberateRefusal(first)) {
        attempts.push(await probeOnce(candidate, 2));
        refusalControl = await control(d, 's06-refusal-control-' + CANDIDATES.indexOf(candidate));
      }
      const last = attempts.at(-1), row = {candidate,...last,attempts,ordinary_requests_before_probe:ordinaryRequests,established_public_role:publicRole,reproducible_refusal:attempts.length === 2 && attempts.every(deliberateRefusal),healthy_after_refusal:Boolean(refusalControl?.succeeded),refusal_control:refusalControl,observation_unavailable:last.crashed ? 'Probe page crashed.' : variant === 'public-server-script' && candidate === '/server.js' && !publicRole ? 'Disposable public-script positive control was not established.' : null};
      row.classification = classifyCandidate(row);rows.push(row);
    }
    const recovery = await control(d, 's06-healthy-recovery'), controls = {initial,recovery};
    return {scenario:'S06',variant,binding:freezeBinding,...overallOutcome(rows,controls),controls,probes:rows,normal_use_provenance:prior,public_role_marker_visible:visiblePublicMarker,disposable_overlay:injection,browser_console:consoleDiagnostics,candidate_response_bodies_read:false,normal_workspace_document_body_read_for_overlay:false,download_contents_read:false,bounded_sample_only:true,criterion_verdicts_produced:false};
  } finally {
    page.off('request', requestListener);
    page.off('console', consoleListener);
    if (variant !== 'golden') await context.unroute(assetURL, assetHandler);
  }
}

module.exports = {runS06Observer, classifyCandidate, overallOutcome, CANDIDATES, VARIANTS, CLASSIFIER_CASES};

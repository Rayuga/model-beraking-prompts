from pathlib import Path
import re
import zipfile

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];TASK=ROOT/'projects/common-ground-ballot'
with zipfile.ZipFile(HERE/'before-r24.zip','x',compression=zipfile.ZIP_DEFLATED) as archive:
 for path in TASK.rglob('*'):
  if path.is_file():archive.writestr(path.relative_to(TASK).as_posix(),path.read_bytes())

runner=TASK/'tests/test.sh';text=runner.read_text(encoding='utf-8')
pattern=r"(cat > /opt/common-ground-verifier/browser-evidence.js <<'COMMON_GROUND_HELPER_1'\n)([\s\S]*?)(\nCOMMON_GROUND_HELPER_1)"
match=re.search(pattern,text);helper=match[2]
helper=helper.replace("version: 'r18'","version: 'r24'")
needle="  async function arm(p, label, options) {"
guard='''  function matches(entry, options, request) {
    if (entry.finishedAt) return false;
    try {
      const result = options.match(request);
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).catch(() => {});
        throw new Error('Capture matchers must return a synchronous boolean');
      }
      if (typeof result !== 'boolean') throw new Error('Capture matchers must return a boolean');
      return result;
    } catch (error) {
      // Playwright event callbacks execute outside the tool's request handler.
      // Never let an evaluator predicate exception terminate the MCP process.
      void finish(entry, new Error('Capture matcher failed: ' + String(error)));
      return false;
    }
  }
'''
assert helper.count(needle)==1;helper=helper.replace(needle,guard+needle)
old="""      const requestListener = request => {
        if (!entry.request && options.match(request)) { entry.request = packet(request); entry.actualRequest = request; entry.state = 'request-captured'; }
      };
      const responseListener = async response => {
        if (response.request() !== entry.actualRequest) return;
        try { await readResponse(entry, response); await finish(entry); }
        catch (error) { await finish(entry, error); }
      };
      const failedListener = request => {
        if (request === entry.actualRequest) void finish(entry, request.failure()?.errorText || 'Request failed');
      };"""
new="""      const requestListener = request => {
        try {
          if (!entry.request && matches(entry, options, request)) {
            entry.request = packet(request); entry.actualRequest = request; entry.state = 'request-captured';
          }
        } catch (error) { void finish(entry, error); }
      };
      const responseListener = async response => {
        try {
          if (response.request() !== entry.actualRequest || entry.finishedAt) return;
          await readResponse(entry, response); await finish(entry);
        } catch (error) { await finish(entry, error); }
      };
      const failedListener = request => {
        try {
          if (request === entry.actualRequest) void finish(entry, request.failure()?.errorText || 'Request failed');
        } catch (error) { void finish(entry, error); }
      };"""
assert old in helper;helper=helper.replace(old,new)
old="""      const handler = async route => {
        if (claimed || !options.match(route.request())) return route.fallback();
        claimed = true;
        entry.request = packet(route.request());
        entry.state = 'request-captured';
        try {
          let requestedDelivery;"""
new="""      const handler = async route => {
        try {
          if (claimed || !matches(entry, options, route.request())) return await route.fallback();
          claimed = true;
          entry.request = packet(route.request());
          entry.state = 'request-captured';
          let requestedDelivery;"""
assert old in helper;helper=helper.replace(old,new)
text=text[:match.start(2)]+helper+text[match.end(2):]
runner.write_text(text,encoding='utf-8',newline='\n')

judge=TASK/'tests/functional/judge.toml';text=judge.read_text(encoding='utf-8')
assert 'cwd =' not in text
text=text.replace('isolated = false\n','isolated = false\ncwd = "/opt/common-ground-verifier"\n',1)
judge.write_text(text,encoding='utf-8',newline='\n')
prompt=TASK/'tests/functional/prompt.md';text=prompt.read_text(encoding='utf-8')
text=text.replace('common-ground-ballot-functional-v1.0.0-r23','common-ground-ballot-functional-v1.0.0-r24',1)
needle='Load the trusted helper using browser_run_code_unsafe'
guidance='''The judge and its Playwright MCP server run from the private verifier directory
`/opt/common-ground-verifier`, so the trusted helper below is within the tool's
allowed file roots. Load that original file directly; never copy evaluator code
into `/app`, read helper code from the submission or enable unrestricted file access.
The unsafe-code VM is not a Node.js module: `URL`, `AbortController`, `require`,
`process` and global timers may be absent there. For capture predicates, compare
`request.method()` and the observed `request.url()` as strings (equality,
`startsWith` or a literal regular expression); do not construct `new URL` inside
an event callback. Native browser APIs inside `page.evaluate` remain separate.
Matchers must return a synchronous boolean. The helper records predicate errors
as `evidence-missing`, detaches that capture and keeps the transport usable.
Treat such a capture error as an automation problem: inspect the retained error,
correct the predicate and recollect with a new label. A repeat of sign-in or a
read is safe; before repeating a mutation, inspect current state and any captured
request/outcome so you do not invent a second action or lose the original receipt.
Never count a tool failure as an observed app refusal or a passing criterion.

'''
assert text.count(needle)==1;text=text.replace(needle,guidance+needle)
prompt.write_text(text,encoding='utf-8',newline='\n')
readme=TASK/'README.md';text=readme.read_text(encoding='utf-8')
text+='''
## Browser evidence runtime

Functional runs from `/opt/common-ground-verifier`, where its root-owned evidence
helper is within Playwright MCP's allowed file roots. It does not copy helper code
into the app or enable unrestricted file access. Helper request listeners and
interception predicates contain errors locally: a malformed matcher is recorded
as missing evidence and removed, rather than terminating the browser transport.
The prompt explains the unsafe-code VM's missing Node/browser globals and safe
string predicates. The evaluator must repair the capture and gather real evidence;
neither tool failures nor absent evidence grant credit.
'''
readme.write_text(text,encoding='utf-8',newline='\n')

# Private runtime sources for review/tests remain outside the task ZIP.
sources=HERE/'runtime-sources';sources.mkdir(exist_ok=True)
for name,marker,body in re.findall(r"cat > /opt/common-ground-verifier/([^ ]+) <<'(COMMON_GROUND_HELPER_\d+)'\n([\s\S]*?)\n\2\n",text if False else runner.read_text()):
 (sources/name).write_text(body+'\n',encoding='utf-8',newline='\n')
previous=ROOT/'reports/common-ground-ballot/2026-09-16-budget-revision-r23'
for name in ('validate-package.py','runtime-smoke.py','run-runtime-checks.py','build-runtime.py','Dockerfile.runtime-validation'):
 content=(previous/name).read_text(encoding='utf-8')
 content=content.replace('actual r23 upload','actual r24 upload').replace('20260916-r23-runtime-validation','20260916-r24-runtime-validation').replace('exact r23 runner','exact r24 runner')
 content=content.replace('23 if dimension == "functional"','24 if dimension == "functional"')
 if name=='validate-package.py':
  content=content.replace("(PREVIOUS/'runtime-sources'/name)","(REPORT/'runtime-sources'/name)")
 (HERE/name).write_text(content,encoding='utf-8',newline='\n')
print('Fixed private helper loading and guarded matcher callbacks; all criteria, weights, timeouts and golden code preserved.')

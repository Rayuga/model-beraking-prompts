#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/common-ground-submission"
SCORE_FINALIZED=0

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
export VERIFIER_LOG_DIR="$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  local tmp_txt tmp_json
  tmp_txt="$(mktemp "$LOG_DIR/.reward.txt.XXXXXX")"
  tmp_json="$(mktemp "$LOG_DIR/.reward.json.XXXXXX")"
  printf '0.0\n' > "$tmp_txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$tmp_json"
  mv -f "$tmp_txt" "$LOG_DIR/reward.txt"
  mv -f "$tmp_json" "$LOG_DIR/reward.json"
  printf '{"tool":{"name":"rewardkit"},"tests":[],"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

cleanup() {
  /opt/common-ground-verifier/app-lifecycle stop 2>/dev/null || true
  if [[ "$SCORE_FINALIZED" != "1" ]]; then write_zero_reward; fi
  ensure_reward
}

write_zero_reward
trap cleanup EXIT
trap 'exit 0' TERM INT HUP
# Evaluator helpers are materialized outside RewardKit's reward-discovery tree.
# Keep the installed Codex binary untouched. A private PATH shim wraps only exec;
# version/login/help are passed to the genuine absolute executable.
install -d -m 700 /opt/common-ground-verifier /opt/common-ground-verifier/bin
cat > /opt/common-ground-verifier/app-lifecycle <<'COMMON_GROUND_HELPER_0'
#!/usr/local/bin/python3
import argparse
import json
import os
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

STATE = Path("/logs/verifier/app-lifecycle.json")


def stop(config):
    pid = config.get("pid")
    if not pid:
        return
    try:
        os.killpg(pid, signal.SIGTERM)
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            os.killpg(pid, 0)
            time.sleep(0.1)
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    config.pop("pid", None)
    STATE.write_text(json.dumps(config))


def start(config):
    with Path(config["log"]).open("ab") as log:
        child = subprocess.Popen(
            ["setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
             "node", config["entry"]],
            env={"PATH": "/usr/local/bin:/usr/bin:/bin",
                 "NODE_PATH": "/usr/local/lib/node_modules", "PORT": "3000",
                 "HOME": "/tmp/common-ground-submission",
                 "DB_PATH": config["database"], "SEED_PATH": config["seed"]},
            cwd=str(Path(config["entry"]).parent),
            stdin=subprocess.DEVNULL, stdout=log, stderr=log,
            start_new_session=True,
        )
    config["pid"] = child.pid
    STATE.write_text(json.dumps(config))
    print(f"Application process: {child.pid}", flush=True)


def ready():
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:3000/api/health", timeout=2) as response:
                if 200 <= response.status < 300:
                    return
        except OSError:
            pass
        time.sleep(0.5)
    raise RuntimeError("Application did not become ready within 60 seconds")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["start", "restart", "stop"])
    parser.add_argument("--entry")
    parser.add_argument("--database")
    parser.add_argument("--seed")
    parser.add_argument("--log", default="/logs/verifier/app.log")
    args = parser.parse_args()
    if args.action == "start":
        if not all((args.entry, args.database, args.seed)):
            parser.error("start requires entry, database and seed")
        STATE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        config = {"entry": args.entry, "database": args.database,
                  "seed": args.seed, "log": args.log}
    else:
        if not STATE.exists():
            if args.action == "stop":
                return
            raise RuntimeError("Application has not been started by the verifier")
        config = json.loads(STATE.read_text())
        stop(config)
    if args.action != "stop":
        start(config)
        if args.action == "restart":
            ready()
            print("Restart ready; existing database preserved.")


if __name__ == "__main__":
    os.umask(0o077)
    main()
COMMON_GROUND_HELPER_0
cat > /opt/common-ground-verifier/browser-evidence.js <<'COMMON_GROUND_HELPER_1'
// Load with browser_run_code_unsafe {"filename":"/opt/common-ground-verifier/browser-evidence.js"}.
// All retained objects belong to the evaluator's Playwright process, never the app.
async (page) => {
  const browser = page.context().browser();
  if (browser.__ballotEvidence) return {installed: true, version: browser.__ballotEvidence.version};
  const entries = new Map();
  const secret = {test: key => /^(authorization|proxyauthorization|cookie|cookies|setcookie|password|passwd|token|accesstoken|refreshtoken|sessiontoken|sessionid|apikey|xapikey|secret|credential|credentials|authtoken|csrftoken)$/.test(String(key).toLowerCase().replace(/[^a-z0-9]/g, ''))};
  const secrets = new Set();
  function clean(value, key = '') {
    if (secret.test(key)) {
      if (typeof value === 'string' && value.length >= 4) secrets.add(value);
      return '[REDACTED]';
    }
    if (Array.isArray(value)) return value.map(item => clean(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, clean(item, name)]));
    if (typeof value === 'string') {
      for (const token of secrets) value = value.split(token).join('[REDACTED]');
      return value.replace(/([?&](?:token|access_token|session_token|api_key|password)=)[^&#]*/gi, '$1[REDACTED]');
    }
    return value;
  }
  const parse = text => { try { return JSON.parse(text); } catch { return text; } };
  const bounded = (p, promise, ms = 15000) => Promise.race([
    promise,
    p.waitForTimeout(ms).then(() => { throw new Error(`Evidence operation exceeded ${ms}ms`); }),
  ]);
  function packet(request) {
    const headers = request.headers();
    for (const [key, value] of Object.entries(headers)) if (secret.test(key)) {
      secrets.add(value);
      for (const cookie of value.split(';')) {
        const at = cookie.indexOf('=');
        if (at >= 0 && cookie.slice(at + 1).trim().length >= 4) secrets.add(cookie.slice(at + 1).trim());
      }
    }
    return {url: request.url(), method: request.method(), body: request.postData(), headers};
  }
  function snapshot(entry) {
    const data = {label: entry.label, state: entry.state, startedAt: entry.startedAt, finishedAt: entry.finishedAt,
      mode: entry.mode, request: entry.request && {url: entry.request.url, method: entry.request.method, body: parse(entry.request.body)},
      response: entry.response, error: entry.error, actionError: entry.actionError};
    return JSON.parse(JSON.stringify(clean(data)));
  }
  function create(p, label, options) {
    if (!label || entries.has(label)) throw new Error('Each evidence label must be unique; do not overwrite an earlier exchange');
    if (typeof options.match !== 'function') throw new Error('Provide a matcher discovered from this UI action');
    let resolve;
    const entry = {page: p, label, state: 'armed', startedAt: new Date().toISOString(), mode: options.mode || 'observe',
      done: new Promise(done => { resolve = done; }), resolve: () => resolve(), cleanup: async () => {}};
    entries.set(label, entry);
    p.setDefaultTimeout(15000);
    return entry;
  }
  async function finish(entry, error) {
    if (entry.finishedAt) return;
    if (error) { entry.error = String(error); entry.state = 'evidence-missing'; }
    else entry.state = 'captured';
    entry.finishedAt = new Date().toISOString();
    try { await entry.cleanup(); } catch (cleanupError) { entry.cleanupError = String(cleanupError); }
    entry.resolve();
  }
  async function readResponse(entry, response) {
    const text = await bounded(entry.page, response.text());
    entry.response = {status: response.status(), body: parse(text)};
    const replay = response.headers()['x-idempotent-replay'];
    if (replay !== undefined) entry.response.replay = replay;
  }
  function matches(entry, options, request) {
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
  async function arm(p, label, options) {
    const entry = create(p, label, options);
    if (entry.mode === 'observe') {
      const requestListener = request => {
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
      };
      entry.cleanup = async () => { p.off('request', requestListener); p.off('response', responseListener); p.off('requestfailed', failedListener); };
      p.on('request', requestListener); p.on('response', responseListener); p.on('requestfailed', failedListener);
    } else {
      if (!['drop', 'hold', 'hold-request', 'unreadable', 'server-error'].includes(entry.mode)) throw new Error('Unknown interruption mode');
      const glob = '**/*';
      let claimed = false;
      const handler = async route => {
        try {
          if (claimed || !matches(entry, options, route.request())) return await route.fallback();
          claimed = true;
          entry.request = packet(route.request());
          entry.state = 'request-captured';
          let requestedDelivery;
          if (entry.mode === 'hold-request') {
            entry.state = 'request-held';
            requestedDelivery = await bounded(p, new Promise(resolve => { entry.release = resolve; }), options.holdMs || 30000);
          }
          const response = await route.fetch({maxRetries: 0, timeout: 15000});
          await readResponse(entry, response);
          // The upstream outcome is retained before any delivery or assertion.
          entry.state = 'upstream-captured';
          let delivery = entry.mode === 'hold-request' ? requestedDelivery || 'deliver' : entry.mode;
          if (entry.mode === 'hold') {
            entry.state = 'response-held';
            delivery = await bounded(p, new Promise(resolve => { entry.release = resolve; }), options.holdMs || 30000);
          }
          if (delivery === 'drop') await route.abort('failed');
          else if (delivery === 'unreadable') await route.fulfill({status: response.status(), contentType: 'application/json', body: '{'});
          else if (delivery === 'server-error') await route.fulfill({status: 503, contentType: 'application/json', body: '{"error":"Temporarily unavailable"}'});
          else await route.fulfill({response});
          await finish(entry);
        } catch (error) { await route.abort('failed').catch(() => {}); await finish(entry, error); }
      };
      entry.cleanup = () => p.unroute(glob, handler);
      await p.route(glob, handler);
    }
    return {label, state: entry.state};
  }
  async function collect(label, timeout = 20000) {
    const entry = entries.get(label);
    if (!entry) throw new Error('Unknown evidence label');
    try { await bounded(entry.page, entry.done, timeout); }
    catch (error) { if (entry.release) entry.release('drop'); await finish(entry, error); }
    return snapshot(entry);
  }
  async function capture(p, label, action, options) {
    await arm(p, label, options);
    try { await bounded(p, Promise.resolve().then(action), 20000); } catch (error) { entries.get(label).actionError = String(error); }
    return collect(label);
  }
  function adaptJson(label, {set = {}, omit = [], url, method} = {}) {
    const original = entries.get(label)?.request;
    if (!original) throw new Error('An actual UI exchange is required before adapting a request');
    const body = JSON.parse(original.body);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Use an observed object payload or adapt its actual non-JSON encoding explicitly');
    for (const name of omit) {
      if (!Object.prototype.hasOwnProperty.call(body, name)) throw new Error(`Cannot omit unobserved field ${name}`);
      delete body[name];
    }
    Object.assign(body, set);
    for (const name of omit) if (Object.prototype.hasOwnProperty.call(body, name)) throw new Error('Omitted field was reintroduced');
    return {url: url || original.url, method: method || original.method, body: JSON.stringify(body)};
  }
  browser.__ballotEvidence = {version: 'r24', arm, capture, collect, adaptJson,
    peek: label => snapshot(entries.get(label)),
    release: (label, delivery = 'deliver') => {
      const entry = entries.get(label);
      if (!entry?.release) throw new Error('No held exchange is ready to release');
      entry.release(delivery); return {label, released: true};
    },
    dump: () => [...entries.values()].map(snapshot),
    note: (label, data) => {
      if (entries.has(label)) throw new Error('Duplicate evidence label');
      const entry = {label, state: 'observation', startedAt: new Date().toISOString(), response: {body: data}};
      entries.set(label, entry); return snapshot(entry);
    },
  };
  return {installed: true, version: 'r24', access: 'page.context().browser().__ballotEvidence'};
}
COMMON_GROUND_HELPER_1
cat > /opt/common-ground-verifier/codex-trace.py <<'COMMON_GROUND_HELPER_2'
#!/usr/bin/env python3
import ctypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time


def timestamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class Redactor:
    def __init__(self):
        self.lock = threading.RLock()
        self.values = set()
        for name, value in os.environ.items():
            if re.search(r'API_?KEY|TOKEN|PASSWORD|SECRET|COOKIE|CREDENTIAL|AUTHORIZATION', name, re.I):
                self.remember(value)

    def remember(self, value):
        if isinstance(value, str) and len(value) >= 4 and not value.startswith('${'):
            self.values.add(value)
            if ';' in value or '=' in value:
                for item in value.split(';'):
                    _, separator, token = item.strip().partition('=')
                    if separator and len(token) >= 4:
                        self.values.add(token)

    def sensitive(self, key):
        name = re.sub(r'[^a-z0-9]', '', str(key).lower())
        return name in {'authorization', 'proxyauthorization', 'cookie', 'cookies', 'setcookie',
                        'password', 'passwd', 'apikey', 'accesstoken', 'refreshtoken', 'idtoken',
                        'sessiontoken', 'sessionid', 'credential', 'credentials', 'secret', 'token',
                        'csrftoken', 'auth', 'authentication'} or name.endswith(('apikey', 'password', 'secret'))

    def collect(self, value):
        if isinstance(value, dict):
            cookie = 'name' in value and 'value' in value and bool(re.search(r'session|token|auth|cookie|(?:^|_)sid$', str(value['name']), re.I))
            for key, item in value.items():
                if self.sensitive(key) or cookie and key == 'value':
                    if isinstance(item, (dict, list)):
                        self.collect_leaves(item)
                    else:
                        self.remember(item)
                else:
                    self.collect(item)
        elif isinstance(value, list):
            for item in value:
                self.collect(item)
        elif isinstance(value, str) and value.lstrip().startswith(('{', '[')):
            try:
                self.collect(json.loads(value))
            except (ValueError, RecursionError):
                pass

    def collect_leaves(self, value):
        if isinstance(value, dict):
            for item in value.values():
                self.collect_leaves(item)
        elif isinstance(value, list):
            for item in value:
                self.collect_leaves(item)
        else:
            self.remember(value)

    def string(self, value):
        for secret in sorted(self.values, key=len, reverse=True):
            value = value.replace(secret, '[REDACTED]')
        value = re.sub(r'(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+', 'Bearer [REDACTED]', value)
        value = re.sub(r'\bsk-[A-Za-z0-9_-]{12,}\b', '[REDACTED]', value)
        value = re.sub(r'(?i)\b(?:cg_session|session_token|access_token|refresh_token)=([^\s;\"\x27,}]+)', lambda m: m.group(0).split('=', 1)[0] + '=[REDACTED]', value)
        value = re.sub(r'(?im)(\b(?:authorization|proxy-authorization|cookie|set-cookie)\b[\"\x27]?\s*[:=]\s*)([^\r\n]+)', r'\1[REDACTED]', value)
        return value

    def walk(self, value):
        if isinstance(value, dict):
            cookie = 'name' in value and 'value' in value and bool(re.search(r'session|token|auth|cookie|(?:^|_)sid$', str(value['name']), re.I))
            return {key: '[REDACTED]' if self.sensitive(key) or cookie and key == 'value' else self.walk(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self.walk(item) for item in value]
        if isinstance(value, str):
            try:
                nested = json.loads(value) if value.lstrip().startswith(('{', '[')) else None
            except (ValueError, RecursionError):
                nested = None
            if isinstance(nested, (dict, list)):
                cleaned = self.walk(nested)
                if cleaned != nested:
                    value = json.dumps(cleaned, ensure_ascii=False)
            return self.string(value)
        return value

    def clean(self, value):
        with self.lock:
            self.collect(value)
            return self.walk(value)

    def text(self, value):
        with self.lock:
            try:
                parsed = json.loads(value)
            except (ValueError, RecursionError):
                return self.string(value)
            self.collect(parsed)
            cleaned = self.walk(parsed)
            return value if cleaned == parsed else json.dumps(cleaned, ensure_ascii=False)


def real_command():
    custom = os.environ.get('CODEX_TRACE_REAL_COMMAND')
    if custom:
        command = json.loads(custom)
        if not isinstance(command, list) or not command or not all(isinstance(item, str) for item in command):
            raise ValueError('CODEX_TRACE_REAL_COMMAND must be a nonempty JSON string array')
        if Path(command[0]).resolve() == Path(__file__).resolve():
            raise ValueError("Trace target must be the real Codex executable")
        return command
    return ['/usr/local/bin/codex']


def output_path(arguments):
    found = None
    supplied = False
    for index, arg in enumerate(arguments):
        if arg in ('-o', '--output-last-message'):
            supplied = True
            if index + 1 < len(arguments):
                found = arguments[index + 1]
        elif arg.startswith('--output-last-message='):
            supplied = True
            found = arg.split('=', 1)[1]
        elif arg.startswith('-o') and not arg.startswith('--') and len(arg) > 2:
            supplied = True
            found = arg[2:]
    return supplied, Path(found) if found else None


def trace_directory(arguments):
    dimension = 'unknown'
    prompt_hash = None
    for arg in arguments:
        match = re.search(r'^Prompt version:\s+[^\r\n]+-(render|constraints|functional|polish|visual)-v[^\s]+', arg, re.M)
        if match:
            dimension = match.group(1)
            prompt_hash = hashlib.sha256(arg.encode('utf-8')).hexdigest()
            break
    root = Path(os.environ.get('VERIFIER_LOG_DIR', '/logs/verifier')) / 'judges' / dimension
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    for attempt in range(1, 10001):
        target = root / f'attempt-{attempt:04d}'
        try:
            target.mkdir(mode=0o700)
            return target, dimension, attempt, prompt_hash
        except FileExistsError:
            continue
    raise RuntimeError('No unused trace attempt directory')


def parent_death_signal():
    if sys.platform.startswith('linux'):
        parent = os.getppid()
        ctypes.CDLL(None).prctl(1, signal.SIGTERM)
        if os.getppid() != parent:
            os.kill(os.getpid(), signal.SIGTERM)


def main():
    arguments = sys.argv[1:]
    command = real_command()
    if not arguments or arguments[0] != 'exec' or any(arg in ('--help', '-h', '--version', '-V') for arg in arguments):
        os.execvpe(command[0], command + arguments, os.environ)
    os.umask(0o077)
    redactor = Redactor()
    destination, dimension, attempt, prompt_hash = trace_directory(arguments)
    started = time.monotonic()
    timing = {'dimension': dimension, 'attempt': attempt, 'started_at': timestamp(), 'status': 'starting',
              'wrapper_pid': os.getpid(), 'prompt_sha256': prompt_hash, 'thread_ids': [], 'rollouts': []}
    timing_path = destination / 'timing.json'
    def write_timing():
        timing_path.write_text(json.dumps(redactor.clean(timing), indent=2) + '\n', encoding='utf-8')
    write_timing()
    json_requested = '--json' in arguments
    caller_supplied_output, caller_output = output_path(arguments)
    process = None
    threads = []
    returncode = 127
    signal_seen = []
    final_text = None
    output_before = caller_output.stat().st_mtime_ns if caller_output and caller_output.exists() else None
    def forward_signal(signum, _frame):
        signal_seen.append(signum)
        if process and process.poll() is None:
            try:
                if os.name == 'posix':
                    os.killpg(process.pid, signum)
                else:
                    process.send_signal(signum)
            except ProcessLookupError:
                pass
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, forward_signal)
    try:
        with tempfile.TemporaryDirectory(prefix='codex-trace-') as private_temp:
            final_path = caller_output if caller_supplied_output else Path(private_temp) / 'final.json'
            forwarded = list(arguments)
            if not json_requested:
                forwarded.append('--json')
            if not caller_supplied_output:
                forwarded.extend(['--output-last-message', str(final_path)])
            popen_options = {'stdin': None, 'stdout': subprocess.PIPE, 'stderr': subprocess.PIPE,
                             'start_new_session': os.name == 'posix'}
            if sys.platform.startswith('linux'):
                popen_options['preexec_fn'] = parent_death_signal
            process = subprocess.Popen(command + forwarded, **popen_options)
            timing.update(status='running', child_pid=process.pid)
            write_timing()
            def consume_stdout():
                with (destination / 'events.jsonl').open('w', encoding='utf-8', buffering=1) as log:
                    for raw in iter(process.stdout.readline, b''):
                        if json_requested:
                            sys.stdout.buffer.write(raw)
                            sys.stdout.buffer.flush()
                        text = raw.decode('utf-8', errors='replace').rstrip('\r\n')
                        try:
                            event = json.loads(text)
                        except ValueError:
                            event = {'type': 'unparsed_stdout', 'text': text}
                        if isinstance(event, dict):
                            thread_id = event.get('thread_id')
                            if isinstance(thread_id, str) and re.fullmatch(r'[0-9a-fA-F-]{32,36}', thread_id) and thread_id not in timing['thread_ids']:
                                timing['thread_ids'].append(thread_id)
                            cleaned = redactor.clean(event)
                        else:
                            cleaned = {'type': 'non_object_event', 'value': redactor.clean(event)}
                        cleaned['_trace_received_at'] = timestamp()
                        cleaned['_trace_elapsed_sec'] = round(time.monotonic() - started, 6)
                        log.write(json.dumps(cleaned, ensure_ascii=False) + '\n')
            def consume_stderr():
                with (destination / 'stderr.log').open('w', encoding='utf-8', buffering=1) as log:
                    for raw in iter(process.stderr.readline, b''):
                        cleaned = redactor.text(raw.decode('utf-8', errors='replace'))
                        log.write(cleaned)
                        log.flush()
                        sys.stderr.write(cleaned)
                        sys.stderr.flush()
            threads = [threading.Thread(target=consume_stdout, daemon=True), threading.Thread(target=consume_stderr, daemon=True)]
            for thread in threads:
                thread.start()
            returncode = process.wait()
            for thread in threads:
                thread.join(timeout=10)
            if any(thread.is_alive() for thread in threads):
                timing['stream_drain_incomplete'] = True
            if final_path and final_path.is_file():
                fresh_output = output_before is None or final_path.stat().st_mtime_ns != output_before or returncode == 0
                if fresh_output:
                    final_text = final_path.read_text(encoding='utf-8', errors='replace')
                    (destination / 'final.json').write_text(redactor.text(final_text), encoding='utf-8')
            timing['final_message_present'] = final_text is not None
            if returncode == 0 and final_text is None and not json_requested:
                returncode = 65
                timing['wrapper_error'] = 'Codex succeeded without a final verdict file'
            session_root = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'sessions'
            if session_root.is_dir() and '--ephemeral' not in arguments:
                for thread_id in timing['thread_ids']:
                    for source in session_root.rglob(f'*{thread_id}*.jsonl'):
                        if source.is_symlink() or not source.is_file():
                            continue
                        output_name = f'rollout-{thread_id}-{len(timing["rollouts"]):02d}.jsonl'
                        target = destination / output_name
                        with source.open(encoding='utf-8', errors='replace') as source_file, target.open('w', encoding='utf-8') as target_file:
                            for line in source_file:
                                target_file.write(redactor.text(line).rstrip('\r\n') + '\n')
                        timing['rollouts'].append(output_name)
    except Exception as error:
        timing['wrapper_error'] = redactor.text(f'{type(error).__name__}: {error}')
        with (destination / 'stderr.log').open('a', encoding='utf-8') as log:
            log.write(timing['wrapper_error'] + '\n')
        sys.stderr.write(timing['wrapper_error'] + '\n')
        if process and process.poll() is None:
            forward_signal(signal.SIGTERM, None)
            try:
                returncode = process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                if os.name == 'posix':
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                returncode = process.wait()
        elif process:
            returncode = process.returncode
    finally:
        timing.update(finished_at=timestamp(), elapsed_sec=round(time.monotonic() - started, 6),
                      returncode=returncode, received_signals=signal_seen,
                      status='succeeded' if returncode == 0 else 'terminated' if returncode < 0 or signal_seen else 'failed')
        for path in destination.iterdir():
            if path.name == 'timing.json' or not path.is_file():
                continue
            cleaned_path = path.with_name(path.name + '.sanitized')
            with path.open(encoding='utf-8', errors='replace') as existing, cleaned_path.open('w', encoding='utf-8') as cleaned:
                for line in existing:
                    cleaned.write(redactor.text(line).rstrip('\r\n') + '\n')
            cleaned_path.replace(path)
        write_timing()
    if not json_requested and final_text is not None:
        sys.stdout.write(redactor.text(final_text))
        sys.stdout.flush()
    if returncode < 0 and os.name == 'posix':
        signum = -returncode
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)
    return returncode


if __name__ == '__main__':
    sys.exit(main())
COMMON_GROUND_HELPER_2
cat > /opt/common-ground-verifier/score <<'COMMON_GROUND_HELPER_3'
#!/usr/local/bin/python3
import json
import math
import sys
import tomllib
from pathlib import Path


def number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Missing or non-numeric {label}")
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"Non-finite {label}")
    return value


def policy(root):
    config = tomllib.loads((root / "reward.toml").read_text())
    if set(config) != {"reward", "composition"} or config["reward"] != [{"name": "reward", "aggregation": "weighted_mean"}]:
        raise ValueError("RewardKit must declare the named intermediate weighted mean")
    composition = config["composition"]
    if set(composition) != {"gates", "weighted_dimensions"}:
        raise ValueError("Unknown composition fields")
    gates = composition["gates"]
    weighted = composition["weighted_dimensions"]
    dimensions = gates + weighted
    if len(dimensions) != 5 or set(dimensions) != {"render", "constraints", "functional", "polish", "visual"}:
        raise ValueError("Each dimension must have exactly one composition role")
    if set(gates) != {"render", "constraints"}:
        raise ValueError("Render and Constraints must be mandatory gates")
    weights = {}
    for dimension in dimensions:
        judge = tomllib.loads((root / dimension / "judge.toml").read_text())
        weight = number(judge["judge"]["weight"], f"{dimension} weight")
        if weight <= 0:
            raise ValueError(f"Non-positive {dimension} weight")
        expected = "all_pass" if dimension in gates else "weighted_mean"
        if judge["scoring"]["aggregation"] != expected:
            raise ValueError(f"Incorrect {dimension} aggregation")
        weights[dimension] = weight
    return gates, weighted, weights


def compose(data, root):
    gates, weighted, weights = policy(root)
    for dimension in gates + weighted:
        value = number(data.get(dimension), f"RewardKit dimension {dimension}")
        if not 0 <= value <= 1:
            raise ValueError(f"Out-of-range RewardKit dimension {dimension}")
        data[dimension] = value
    if any(data[dimension] <= 0 for dimension in gates):
        return 0.0
    return round(sum(data[dimension] * weights[dimension] for dimension in weighted) / sum(weights[dimension] for dimension in weighted), 4)


def write_outputs(json_path, text_path, ctrf_path, root):
    data = json.loads(json_path.read_text())
    data["reward"] = compose(data, root)
    data["graded"] = 1
    data["no_op"] = 0
    dimensions = policy(root)[0] + policy(root)[1]
    cases = [{"name": dimension, "status": "passed" if data[dimension] > (0.05 if dimension == "functional" else 0) else "failed"} for dimension in dimensions]
    passed = sum(case["status"] == "passed" for case in cases)
    json_path.write_text(json.dumps(data, indent=2) + "\n")
    text_path.write_text(f"{data['reward']:.4f}\n")
    ctrf_path.write_text(json.dumps({"tool": {"name": "rewardkit"}, "tests": cases, "summary": {"passed": passed, "failed": len(cases) - passed, "skipped": 0, "total": 5}}, indent=2) + "\n")


if __name__ == "__main__":
    write_outputs(*(Path(value) for value in sys.argv[1:4]), Path("/tests"))
COMMON_GROUND_HELPER_3
cat > /opt/common-ground-verifier/prompt-provenance <<'COMMON_GROUND_HELPER_4'
#!/usr/local/bin/python3
import hashlib
import json
import re
import sys
from pathlib import Path

def record_provenance():
    root = Path('/tests')
    private = Path('/opt/common-ground-verifier')
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    record = {'task': 'common-ground-ballot', 'task_version': '1.0.0', 'judges': {}}
    for dimension in ('render', 'constraints', 'functional', 'polish', 'visual'):
        prompt = root / dimension / 'prompt.md'
        text = prompt.read_text()
        versions = re.findall(r'^Prompt version: (.+)$', text, re.M)
        assert re.findall(r'^Task version: (.+)$', text, re.M) == ['1.0.0']
        assert len(versions) == 1 and re.fullmatch('common-ground-ballot-' + dimension + r'-v1\.0\.0-r[1-9]\d*', versions[0])
        record['judges'][dimension] = {'prompt_version': versions[0], 'prompt_sha256': sha(prompt), 'judge_sha256': sha(root / dimension / 'judge.toml')}
    record['runner_sha256'] = sha(root / 'test.sh')
    record['reward_sha256'] = sha(root / 'reward.toml')
    record['resource_sha256'] = {name: sha(private / name) for name in ('score', 'app-lifecycle', 'browser-evidence.js', 'codex-trace.py', 'prompt-provenance')}
    return record

if __name__ == '__main__':
    record = record_provenance()
    Path(sys.argv[1]).write_text(json.dumps(record, indent=2) + '\n')
    print('Prompt provenance: ' + json.dumps(record, sort_keys=True), flush=True)
COMMON_GROUND_HELPER_4
# These commands belong to the verifier. The submission entry is /app/server.js.
chmod 700 /opt/common-ground-verifier/app-lifecycle \
  /opt/common-ground-verifier/prompt-provenance /opt/common-ground-verifier/score \
  /opt/common-ground-verifier/codex-trace.py
ln -sfn /opt/common-ground-verifier/codex-trace.py /opt/common-ground-verifier/bin/codex
export CODEX_TRACE_REAL_COMMAND='["/usr/local/bin/codex"]'
export PATH="/opt/common-ground-verifier/bin:$PATH"
test -x /usr/local/bin/codex
timeout 20 codex --version > "$LOG_DIR/codex-version.txt" 2>&1

/opt/common-ground-verifier/prompt-provenance "$LOG_DIR/prompt-provenance.json"

if [[ ! -f /app/server.js ]]; then exit 0; fi
while IFS= read -r app_link; do
  resolved_link="$(readlink -f -- "$app_link" 2>/dev/null || true)"
  case "$resolved_link" in
    /app/*|/usr/local/lib/node_modules/*) ;;
    *) exit 0 ;;
  esac
done < <(find /app -type l -print 2>/dev/null)

if [[ ! -f /app/common_ground_seed.json ]]; then exit 0; fi

rm -f /app/commonground.db /app/commonground.db-shm /app/commonground.db-wal
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/commonground.db"
APP_SEED="/app/common_ground_seed.json"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/commonground.db"
  APP_SEED="$APP_COPY/common_ground_seed.json"
fi

/opt/common-ground-verifier/app-lifecycle start --entry "$APP_ENTRY" \
  --database "$APP_DB" --seed "$APP_SEED" --log "$LOG_DIR/app.log"

READY=0
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then exit 0; fi

if ! timeout 12600 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

if ! /opt/common-ground-verifier/score "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" "$LOG_DIR/ctrf.json"
then
  write_zero_reward
  exit 0
fi
SCORE_FINALIZED=1

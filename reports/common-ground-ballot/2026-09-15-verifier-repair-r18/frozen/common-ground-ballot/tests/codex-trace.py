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
        return command
    return ['/usr/local/bin/codex-original']


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

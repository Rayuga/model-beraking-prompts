"""Validate the shipped foundation in a disposable container; no provider calls.

Mount task readonly at /task and an evidence directory at /results. This script
copies only the supplied starter and seed into /app. It never reads a solution.
The absent business routes remain deliberately unimplemented.
"""
import ast
import contextlib
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import subprocess
import time
import urllib.error
import urllib.request

OUT = Path('/results')
OUT.mkdir(parents=True, exist_ok=True)
APP = Path('/app')
APP.mkdir(exist_ok=True)
SOURCE = Path('/task/environment/assets/starter')
SEED = Path('/task/environment/assets/artifacts/common_ground_seed.json')
results = []
process = None
log = None


def save():
    OUT.joinpath('foundation-results.json').write_text(json.dumps({
        'scope': 'supplied foundation runtime/authentication/seed only; no completed-product claim',
        'passed': sum(row['passed'] for row in results),
        'failed': sum(not row['passed'] for row in results), 'results': results,
    }, indent=2) + '\n', encoding='utf-8')


@contextlib.contextmanager
def check(name):
    try:
        yield
    except Exception as error:
        results.append({'name': name, 'passed': False, 'error': str(error)})
        save()
        raise
    else:
        results.append({'name': name, 'passed': True})
        print('PASS', name, flush=True)
        save()


class Browser:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, path, method='GET', body=None, original_cookie=None):
        headers = {'Content-Type': 'application/json'} if body is not None else {}
        if original_cookie is not None:
            headers['Cookie'] = original_cookie
        request = urllib.request.Request('http://localhost:3000' + path, method=method,
            data=None if body is None else json.dumps(body).encode('utf-8'), headers=headers)
        try:
            response = self.opener.open(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read().decode('utf-8'))

    def session(self):
        # Retained only in process memory; never serialized to evidence.
        matches = [cookie.name + '=' + cookie.value for cookie in self.jar if cookie.name == 'cg_session']
        assert len(matches) == 1, 'Expected one issued session cookie'
        return matches[0]

    def login(self, who='ruth.adebayo', password='CommonGround!2026'):
        return self.request('/api/auth/login', 'POST', {'email': who + '@commonground.example', 'password': password})

    def identity(self):
        return self.request('/api/me')[1]['user']


def start():
    global process, log
    log = OUT.joinpath('foundation-server.log').open('ab')
    environment = dict(os.environ, PORT='3000', DB_PATH='/app/commonground.db',
                       SEED_PATH='/app/common_ground_seed.json', NODE_PATH='/usr/local/lib/node_modules')
    process = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'node', 'server.js'],
        cwd=APP, env=environment, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    for attempt in range(100):
        if process.poll() is not None:
            raise RuntimeError('Foundation server exited; inspect foundation-server.log')
        try:
            if Browser().request('/api/health')[0] == 200:
                return process.pid
        except (OSError, urllib.error.URLError):
            time.sleep(.1)
    raise RuntimeError('Foundation did not become healthy within ten seconds')


def stop():
    global process, log
    if process is not None and process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=2)
    if log is not None:
        log.close()
    process = None
    log = None


def seed_snapshot():
    # Read-only local foundation validation; no session hashes/passwords exported.
    with sqlite3.connect('file:/app/commonground.db?mode=ro', uri=True) as database:
        integrity = database.execute('PRAGMA integrity_check').fetchone()[0]
        tables = [row[0] for row in database.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        counts = {table: database.execute('SELECT count(*) FROM "' + table.replace('"', '""') + '"').fetchone()[0] for table in tables}
        ballots = list(database.execute('SELECT id,title,status,revision FROM ballots ORDER BY id'))
        members = list(database.execute('SELECT user_id,active,revision FROM memberships ORDER BY user_id'))
        seed_state = list(database.execute('SELECT key,value FROM seed_state ORDER BY key'))
    return {'integrity': integrity, 'counts': counts, 'ballots': ballots, 'members': members, 'seed_state': seed_state}


def main():
    shutil.copytree(SOURCE, APP, dirs_exist_ok=True)
    shutil.copyfile(SEED, APP / 'common_ground_seed.json')
    subprocess.run(['chown', '-R', '65534:65534', str(APP)], check=True)
    with check('foundation launches unprivileged with embedded seed, health and unfinished business routes'):
        start()
        assert Browser().request('/api/health')[0] == 200
        assert Browser().request('/api/ballots')[0] == 501, 'Starter unexpectedly supplies the ballot product'
        initial = seed_snapshot()
        assert initial['integrity'] == 'ok'
        assert initial['counts']['users'] == 4 and initial['counts']['ballots'] == 4
        assert initial['counts']['memberships'] == 2 and initial['counts']['sessions'] == 0
        assert len(initial['seed_state']) == 1
    wrong = Browser()
    with check('wrong password is refused without issuing an authenticated session'):
        assert wrong.login(password='CommonGround!wrong')[0] == 401
        assert wrong.identity() is None
        assert wrong.request('/api/auth/logout', 'POST')[0] == 401
        assert seed_snapshot()['counts']['sessions'] == 0
    a, b = Browser(), Browser()
    with check('independent legitimate sign-ins issue distinct working sessions'):
        for client in (a, b):
            status, body = client.login()
            assert status == 200 and body['user']['id'] == 'user-ruth'
            assert client.identity()['role'] == 'coordinator'
        assert a.session() != b.session()
        original_a, original_b = a.session(), b.session()
    members = {}
    with check('all documented foundation identities and roles authenticate correctly'):
        for user, expected_id, expected_role in [('arun.das', 'user-arun', 'observer'),
                                                ('leila.ward', 'user-leila', 'member'),
                                                ('owen.park', 'user-owen', 'member')]:
            client = Browser()
            assert client.login(user)[0] == 200
            assert client.identity()['id'] == expected_id
            assert client.identity()['role'] == expected_role
            members[expected_id] = client
    with check('ordinary sign-out revokes only that session including retained-cookie replay'):
        assert a.request('/api/auth/logout', 'POST')[0] == 200
        assert a.identity() is None
        assert b.identity()['id'] == 'user-ruth'
        replay = Browser()
        assert replay.request('/api/me', original_cookie=original_a)[1]['user'] is None
        assert replay.request('/api/auth/logout', 'POST', original_cookie=original_a)[0] == 401
        assert a.login()[0] == 200
        renewed_a = a.session()
        assert renewed_a != original_a
    with check('end-all-sessions revokes both same-person sessions while another person stays signed in'):
        assert b.request('/api/auth/logout-all', 'POST')[0] == 200
        assert a.identity() is None and b.identity() is None
        for credential in (renewed_a, original_b):
            assert Browser().request('/api/me', original_cookie=credential)[1]['user'] is None
            assert Browser().request('/api/auth/logout', 'POST', original_cookie=credential)[0] == 401
        assert members['user-leila'].identity()['id'] == 'user-leila'
        assert a.login()[0] == 200
    before = seed_snapshot()
    for index in (1, 2):
        with check('seed, SQLite records and live authentication survive process restart ' + str(index)):
            old_pid = process.pid
            stop()
            new_pid = start()
            assert new_pid != old_pid
            assert a.identity()['id'] == 'user-ruth'
            assert members['user-leila'].identity()['id'] == 'user-leila'
            assert seed_snapshot() == before, 'Restart changed or duplicated seed/session records'
    OUT.joinpath('foundation-seed-summary.json').write_text(json.dumps(before, indent=2), encoding='utf-8')


try:
    main()
finally:
    stop()
    save()

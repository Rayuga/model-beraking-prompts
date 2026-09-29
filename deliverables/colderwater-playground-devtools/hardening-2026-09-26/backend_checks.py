import concurrent.futures
import json
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:3313'
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
RESULT = {'kind': 'Local deterministic backend evidence; not a paid Oracle score', 'checks': [], 'requests': []}

def check(name, condition, observed=None):
    RESULT['checks'].append({'name': name, 'passed': bool(condition), 'observed': observed})
    if not condition:
        raise AssertionError(name + ': ' + repr(observed))

def request(method, route, data=None, raw=None):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    req = urllib.request.Request(BASE + route, data=body, method=method, headers={'Content-Type': 'application/json'})
    try:
        with HTTP.open(req, timeout=15) as res:
            status, payload = res.status, res.read()
    except urllib.error.HTTPError as res:
        status, payload = res.code, res.read()
    try:
        value = json.loads(payload)
    except ValueError:
        value = payload.decode(errors='replace')
    RESULT['requests'].append({'method': method, 'route': route, 'status': status, 'response': value})
    return status, value

def record(record_id):
    status, value = request('GET', '/api/snippets/' + str(record_id))
    check('Record reread succeeds', status == 200, status)
    return value

def snapshot():
    status, value = request('GET', '/api/snippets')
    check('Library reread succeeds', status == 200, status)
    return sorted(value, key=lambda row: row['id'])

def create(title, filename='sample.js', code='console.log("saved");\n'):
    status, value = request('POST', '/api/snippets', {'title': title, 'filename': filename, 'code': code})
    check('Create positive control', status == 201 and value.get('revision') == 1, value)
    return value

def rejected_unchanged(name, method, route, data, expected_statuses=(400, 409), raw=None):
    before = snapshot()
    status, value = request(method, route, data, raw)
    check(name + ' refused with useful reason', status in expected_statuses and isinstance(value, dict) and bool(value.get('error')), {'status': status, 'body': value})
    check(name + ' leaves complete library unchanged', snapshot() == before)

try:
    suffix = uuid.uuid4().hex[:8]
    check('Health responds', request('GET', '/api/health')[0] == 200)
    a = create('Revision ' + suffix, code='const unicode = "日本語 ✓";\nconsole.log(unicode);\n')
    b = create('Sibling ' + suffix, filename='STYLE.CSS', code='body { color: #abc; }\n')
    check('Exact source and filename roundtrip', record(a['id']) == a and record(b['id']) == b)
    original = dict(a)
    status, a = request('PUT', '/api/snippets/' + str(a['id']), {**a, 'code': 'console.log("newer");\n'})
    check('Valid update advances revision exactly once', status == 200 and a['revision'] == 2 and a['code'] == 'console.log("newer");\n', a)
    rejected_unchanged('Stale save', 'PUT', '/api/snippets/' + str(a['id']), {**original, 'code': 'stale'}, (409,))
    rejected_unchanged('Stale rename', 'PUT', '/api/snippets/' + str(a['id']), {**original, 'title': 'Stale title'}, (409,))
    rejected_unchanged('Stale delete', 'DELETE', '/api/snippets/' + str(a['id']), {'revision': original['revision']}, (409,))
    for revision in (None, 0, -1, 2.5, '2', True):
        rejected_unchanged('Invalid revision ' + repr(revision), 'PUT', '/api/snippets/' + str(a['id']), {**a, 'revision': revision}, (409,))
    rejected_unchanged('Duplicate create title after trim', 'POST', '/api/snippets', {**b, 'title': '  ' + b['title'] + ' '}, (409,))
    rejected_unchanged('Rename collision after trim', 'PUT', '/api/snippets/' + str(a['id']), {**a, 'title': ' ' + b['title'] + ' '}, (409,))
    for filename in ('', 'sample.txt', '../bad.js', 'a/b.js', 'a\\b.js', 'bad\x00.js'):
        rejected_unchanged('Invalid filename ' + repr(filename), 'PUT', '/api/snippets/' + str(a['id']), {**a, 'filename': filename}, (400,))
    for title in ('', '   ', 42):
        rejected_unchanged('Invalid title ' + repr(title), 'PUT', '/api/snippets/' + str(a['id']), {**a, 'title': title}, (400,))
    rejected_unchanged('Nontext code', 'PUT', '/api/snippets/' + str(a['id']), {**a, 'code': {}}, (400,))
    rejected_unchanged('Malformed JSON', 'PUT', '/api/snippets/' + str(a['id']), None, (400,), raw=b'{')
    status, a = request('PUT', '/api/snippets/' + str(a['id']), {**a, 'title': '  Renamed ' + suffix + '  '})
    check('Fresh rename succeeds and trims', status == 200 and a['revision'] == 3 and a['title'] == 'Renamed ' + suffix, a)
    copy = create('Duplicate ' + suffix, a['filename'], a['code'])
    status, copy_changed = request('PUT', '/api/snippets/' + str(copy['id']), {**copy, 'code': 'copy only'})
    check('Duplicate remains independent', status == 200 and record(a['id']) == a and copy_changed['code'] == 'copy only')
    same_case_variant = create(a['title'].upper())
    check('Title comparison is case sensitive', same_case_variant['id'] != a['id'])
    race = create('Race ' + suffix)
    def competing_write(index):
        return request('PUT', '/api/snippets/' + str(race['id']), {**race, 'code': 'writer ' + str(index)})
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        outcomes = list(pool.map(competing_write, range(6)))
    check('Concurrent same-revision saves have exactly one winner', sorted(s for s, _ in outcomes) == [200, 409, 409, 409, 409, 409], [s for s, _ in outcomes])
    winner = next(v for s, v in outcomes if s == 200)
    check('Concurrent winner persisted with exactly one revision increment', record(race['id']) == winner and winner['revision'] == 2)
    collision_title = 'Create race ' + suffix
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        outcomes = list(pool.map(lambda _: request('POST', '/api/snippets', {'title': collision_title, 'filename': 'race.js', 'code': ''}), range(4)))
    check('Concurrent duplicate creates have exactly one winner', sorted(s for s, _ in outcomes) == [201, 409, 409, 409], [s for s, _ in outcomes])
    status, value = request('DELETE', '/api/snippets/' + str(a['id']), {'revision': a['revision']})
    check('Fresh delete succeeds', status == 200 and value.get('ok') is True)
    rejected_unchanged('Save deleted identity cannot recreate record', 'PUT', '/api/snippets/' + str(a['id']), a, (404,))
    rejected_unchanged('Repeated delete', 'DELETE', '/api/snippets/' + str(a['id']), {'revision': a['revision']}, (404,))
    check('Deleting one record leaves sibling exact', record(b['id']) == b)
    for route in ('/server.js', '/app.db', '/.env', '/api/snippets/1abc', '/api/snippets/0', '/api/snippets/99999999999999999999'):
        check('Private or invalid route refused: ' + route, request('GET', route)[0] == 404)
    before_restart = snapshot()
    subprocess.run(['docker', 'restart', 'colderwater-api-hardening'], check=True, capture_output=True, text=True)
    for attempt in range(50):
        try:
            if request('GET', '/api/health')[0] == 200:
                break
        except OSError:
            time.sleep(.2)
    check('Restart retains every record and revision', snapshot() == before_restart)
    check('Restart does not recreate deleted identity', request('GET', '/api/snippets/' + str(a['id']))[0] == 404)
    RESULT['passed'] = True
except Exception as error:
    RESULT['passed'] = False
    RESULT['error'] = repr(error)
    raise
finally:
    (HERE / 'backend_results.json').write_text(json.dumps(RESULT, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'passed': RESULT.get('passed'), 'checks': len(RESULT['checks']), 'error': RESULT.get('error')}))

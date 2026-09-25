from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
old = ROOT/'reports/common-ground-ballot/2026-09-16-qc-repair-r19'
script = (old/'runtime-smoke.py').read_text(encoding='utf-8')
script = script.replace('import hashlib\n','import hashlib\nimport http.cookiejar\nimport urllib.request\n')
needle = '    discovered = discover(root)\n'
script = script.replace(needle, '''    # Exercise the exact generated lifecycle command on the real golden server,
    # retaining a real session across restart; no credentials enter artifacts.
    private = Path('/opt/common-ground-verifier')
    for name in ('app-lifecycle', 'prompt-provenance', 'score'):
        path = private / name
        assert path.read_text().startswith('#!/usr/local/bin/python3\\n')
        assert path.stat().st_mode & 0o777 == 0o700
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(jar))
    payload = json.dumps({'email':'ruth.adebayo@commonground.example','password':'CommonGround!2026'}).encode()
    with client.open(urllib.request.Request('http://127.0.0.1:3000/api/auth/login',data=payload,headers={'Content-Type':'application/json'}),timeout=5) as response:
        assert response.status == 200
    def ballots():
        with client.open('http://127.0.0.1:3000/api/ballots',timeout=5) as response:
            return json.load(response)
    before = ballots()
    assert len(before['ballots']) == 4
    state = json.loads(Path('/logs/verifier/app-lifecycle.json').read_text())
    assert state['entry'] == '/app/server.js'
    uid = next(line for line in Path('/proc',str(state['pid']),'status').read_text().splitlines() if line.startswith('Uid:'))
    assert set(uid.split()[1:]) == {'65534'}
    command([str(private/'app-lifecycle'),'restart'],timeout=75)
    assert ballots() == before
    discovered = discover(root)
''')
script = script.replace('"root_python_candidates": [], "argv": sys.argv[2:],','"root_python_candidates": [], "argv": sys.argv[2:],\n        "golden_start_and_restart": True, "private_executable_modes": True, "unprivileged_node_entry": state["entry"],')
start = script.index('    fixture_created = not (app / "server.js").exists()')
end = script.index('    fakebin = ',start)
script = script[:start] + '''    fixture_created = False
    seed = Path('/assets/artifacts')
    seed.mkdir(parents=True,exist_ok=True)
    shutil.copyfile('/task/environment/assets/artifacts/common_ground_seed.json',seed/'common_ground_seed.json')
    subprocess.run(['bash','/task/solution/solve.sh'],check=True)
''' + script[end:]
script = script.replace('        discovery = json.loads(discovery_path.read_text(encoding="utf-8"))', '''        discovery = json.loads(discovery_path.read_text(encoding="utf-8"))
        check(f"runner {attempt} launches real golden Node app unprivileged and restarts with session/data retained", discovery['golden_start_and_restart'] and discovery['unprivileged_node_entry'] == '/app/server.js')
        check(f"runner {attempt} invokes private executable helpers with mode 700", discovery['private_executable_modes'])''')
script = script.replace('common-ground-r19-smoke-bin','common-ground-r20-smoke-bin')
script = script.replace('"health_fixture_created": fixture_created,','"health_fixture_created": fixture_created, "real_golden_app_installed": True,')
(HERE/'runtime-smoke.py').write_text(script,encoding='utf-8',newline='\n')
host = (old/'run-runtime-checks.py').read_text(encoding='utf-8').replace('20260916-r19-runtime-validation','20260916-r20-runtime-validation')
host = host.replace("sys.argv[1:] or ['runtime-smoke','foundation-runtime']", "sys.argv[1:] or ['runtime-smoke']")
(HERE/'run-runtime-checks.py').write_text(host,encoding='utf-8',newline='\n')
print('Exact runner test uses the real golden app, private executable commands, and actual restarts.')

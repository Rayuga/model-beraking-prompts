from pathlib import Path
import hashlib, json, re

here = Path(__file__).resolve().parent
root = Path.cwd()
run = root/'qc/runs/coldwater-2026-10-01-history-hardening-r2'
inputs = json.loads((here/'proof-inputs.json').read_text(encoding='utf-8'))
facts = {}
for phase in ['history','post','runtime']:
    report = json.loads((here/f'{phase}-results.json').read_text(encoding='utf-8'))
    assert not report.get('fatal'), report.get('fatal')
    assert all(row['status']=='observed pass' for row in report['observations']), phase
    facts.update(report['facts'])
coverage = []
for row in inputs['criteria']:
    key = re.match(r'(S\d+\.[a-z0-9_]+):', row['description'].strip())[1]
    coverage.append({'id':row['id'],'key':key,'observed':facts.get(key,{}).get('passed',False)})
assert len(coverage)==80 and all(row['observed'] for row in coverage), [r for r in coverage if not r['observed']]
(here/'functional-coverage.json').write_text(json.dumps(coverage,indent=2),encoding='utf-8')
for name in ['surface-results','canvas-regression','computed-luna-gate','computed-mock-gate','full-install-binding']:
    assert json.loads((here/f'{name}.json').read_text(encoding='utf-8'))['passed'], name
files = [p for p in here.iterdir() if p.is_file() and p.suffix in {'.json','.png'}]
files += list((here/'drivers').glob('*'))
index = {
    'scope':'Exact-current full installation and scripted browser observations, not configured judge runs or portal QC',
    'input_sha256':json.loads((run/'manifest.json').read_text(encoding='utf-8'))['input_sha256'],
    'artifacts':{p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()},
    'observations':[
        '80 functional outcomes mapped to passing scripted observations; actual Docker restart between history and post phases.',
        'Both gates and six polish outcomes passed in scripted checks; screenshots are visual evidence, not measured Likert grades.',
        'Canvas and user-entered form state survive error, Stop and timeout. The actual S10 fixture includes a painted canvas.',
        'Revised computed-output Render prerequisite passes golden and downloaded old Luna, and rejects the unchanged literal-string mock.',
        'Full solve.sh installation copies every solution file into the exact-current agent image. Server runs from /tmp with the image-global native SQLite package. No task-local node_modules.',
    ],
    'limits':[
        'No configured Oracle score or newly built Luna score is measured for this candidate. Prior release scores do not transfer.',
        'First local attempt is retained in attempt1: an image-based canvas correction failed due to inherited CSP; four driver setups lacked their required fixture flag. Source and driver fixes preceded all final observations.',
        'The first attempt and R1 audit remain historical evidence, not current passes. The new shared prompt-argv isolation concern is not covered by the old restart exception.',
        'Frozen QC snapshot is committed source d327054e. Current pipeline still needs independent reviews and required judge measurement records; this index does not provide those records.',
    ],
    'commands':[
        'docker build -t qc-coldwater-history:r2 projects/colderwater-playground-devtools/environment',
        'docker run -d --name cw-history-r2b-golden -p 3011:3000 -e DB_PATH=/tmp/cw-history-r2.db --mount <solution:/solution:readonly> --mount <this-evidence:/evidence> --entrypoint bash qc-coldwater-history:r2 /evidence/drivers/full_install_start.sh',
        'docker run --rm --network container:cw-history-r2b-golden --mount <this-evidence:/evidence> --entrypoint node colderwater-verifier:postrepair-audit-20260930 /evidence/drivers/strict_proof.cjs history',
        'docker restart cw-history-r2b-golden',
        'docker run --rm --network container:cw-history-r2b-golden --mount <this-evidence:/evidence> --entrypoint node colderwater-verifier:postrepair-audit-20260930 /evidence/drivers/strict_proof.cjs post',
        'docker run --rm --network container:cw-history-r2b-golden --mount <this-evidence:/evidence> --entrypoint node colderwater-verifier:postrepair-audit-20260930 /evidence/drivers/strict_proof.cjs runtime',
        'docker run --rm --network container:cw-history-r2b-golden -e CW_LOG_DIR=/evidence --mount <this-evidence:/evidence> --entrypoint node colderwater-verifier:postrepair-audit-20260930 /evidence/drivers/surface_flow.cjs',
        'docker run --rm --network container:cw-history-r2b-golden --mount <this-evidence:/evidence> --entrypoint node colderwater-verifier:postrepair-audit-20260930 /evidence/drivers/canvas_regression.cjs',
    ]}
(run/'raw-evidence-index.json').write_text(json.dumps(index,indent=2),encoding='utf-8')
print(json.dumps({'functional_passed':len(coverage),'artifacts':len(index['artifacts']),'index':str(run/'raw-evidence-index.json')}))

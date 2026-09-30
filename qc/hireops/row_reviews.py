"""Prepare/collect the supplemental one-context-per-quality-point audit.

This records independent reports; it never assigns a review verdict.
The generic pipeline still owns the three full reviews and runtime clearance.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from qc_pipeline import verify_frozen, RUNTIME_ROWS


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def prepare(run):
    manifest = read(run / 'manifest.json')
    errors = verify_frozen(run, manifest)
    if errors:
        raise ValueError(errors)
    output = run / 'per-row-review'
    output.mkdir(exist_ok=False)
    (output / 'prompts').mkdir()
    (output / 'rows').mkdir()
    checks = read(run / 'checklist.json')['quality']
    cache = ROOT / manifest['cache']
    wbpath = cache / 'rules/WebDev Rubrics QC.xlsx'
    wb = openpyxl.load_workbook(wbpath, data_only=True)
    save(output / 'workbook-content.json', {s.title: [list(row) for row in s.values if any(v is not None for v in row)] for s in wb})
    for row in checks:
        n = row['number']
        prompt = f'''Review ONLY quality check {n:02d}: {row['id']}.
This is one of 53 distinct independent agent contexts. Do not read any other
row report or full-review verdict. Do not edit task sources, rules or evidence.
Read-only local inspection and source probes are permitted. No paid calls,
uploads, external messages, package installation, or changes to other outputs.

Workspace: {ROOT.as_posix()}
Frozen task: {cache.relative_to(ROOT).as_posix()}/task
Logical task name: hireops-recruiting-operations (snapshot directory 'task' is intentional).
Input SHA256: {manifest['input_sha256']}
Workbook check: {row['what']}

Read the ACTUAL frozen workbook row in Quality Checks and matching Internal
Quality Checks annotation using openpyxl. Read the frozen skill SKILL.md and
matching references/quality-checks.md section, relevant staged contract and
deterministic procedures. Apply qc/REVIEW_POLICY.md corrections. Workbook and
skill are both required; interpretation notes do not override current policy.
Python: {Path(sys.executable).as_posix()}. Node22: .tools/hireops/node.exe.
The optional workbook-content.json is a convenient extraction, not proof of review.

Inspect all files relevant to your check and try concrete conforming-app
false-fail and defective-app false-pass examples. Cite exact paths/lines or
named sections and quote evidence. Do not infer private route/selector/UI
requirements. Distinguish inherited canonical defects from task defects.
Source checks, local Windows Node/Chrome tests, actual Linux verifier, configured
Oracle and Luna results are different evidence. Read {run.relative_to(ROOT).as_posix()}/evidence-index.json
for available raw evidence, verify binding, and leave unmeasured checks explicit.
No scripted duration establishes configured-judge workload or scoring quality.

Write ONE report to {output.relative_to(ROOT).as_posix()}/rows/{n:02d}.json:
{{"number":{n},"id":"{row['id']}","input_sha256":"{manifest['input_sha256']}",
 "reviewer":"<your unique actual agent name>","verdict":"Pass|Fail|Note|N-A|Not exercised",
 "risk":true,"severity":"P0|P1|P2|P3 or null","evidence":"detailed cited observations",
 "counterexample":"concrete witness or null","suggested_fix":"bounded fix or null",
 "run_verdict":"CONFIRMED|REFUTED|PARTIAL|NOT EXERCISED",
 "sources_read":["actual files and workbook sheet/row"]}}
Use true risk for a credible defect or required missing measurement, false otherwise.
Return your check number and concise result. Do not claim overall QC clearance.
'''
        (output / f'prompts/{n:02d}.md').write_text(prompt, encoding='utf-8')
    save(output / 'assignment.json', {'input_sha256': manifest['input_sha256'], 'checks': checks,
         'mode': '53 distinct contexts, one complete quality point each, up to 3 simultaneous workers',
         'workbook_sha256': hashlib.sha256(wbpath.read_bytes()).hexdigest()})
    print(json.dumps({'prompts': len(checks), 'directory': str(output.relative_to(ROOT))}))


def collect(run):
    manifest = read(run / 'manifest.json')
    output = run / 'per-row-review'
    assignment = read(output / 'assignment.json')
    invalid = verify_frozen(run, manifest)
    rows, missing = [], []
    for expected in assignment['checks']:
        path = output / f"rows/{expected['number']:02d}.json"
        if not path.is_file():
            missing.append(expected['number'])
            continue
        try:
            row = read(path)
            assert row['number'] == expected['number'] and row['id'] == expected['id']
            assert row['input_sha256'] == manifest['input_sha256']
            assert row['verdict'] in {'Pass', 'Fail', 'Note', 'N-A', 'Not exercised'}
            assert type(row['risk']) is bool and row['evidence'] and row['sources_read'] and row['reviewer']
            if row['verdict'] == 'Fail':
                assert row['counterexample'] and row['suggested_fix']
            if row['id'] in RUNTIME_ROWS and row['verdict'] == 'Pass':
                records = read(run / 'runtime-evidence.json') if (run / 'runtime-evidence.json').is_file() else {}
                assert records.get(row['id'], {}).get('observed') is True, 'Unmeasured runtime row marked Pass'
            rows.append(row)
        except Exception as exc:
            invalid.append(f'{path.name}: {exc}')
    names = [row['reviewer'] for row in rows]
    if len(names) != len(set(names)):
        invalid.append('Reviewer context reused across points')
    risks = [row for row in rows if row['risk'] or row['verdict'] in {'Fail', 'Not exercised'}]
    status = 'INCOMPLETE' if missing or invalid else 'BLOCKED' if risks else 'SOURCE_REVIEW_COMPLETE'
    result = {'status': status, 'input_sha256': manifest['input_sha256'], 'completed': len(rows),
              'missing': missing, 'invalid': invalid, 'verdicts': dict(Counter(row['verdict'] for row in rows)),
              'risks': risks, 'portal_pass_claimed': False}
    save(output / 'summary.json', result)
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = '53 independent quality reviews'
    sheet.append(['Number', 'Check', 'Verdict', 'Risk', 'Evidence', 'Counterexample', 'Fix', 'Reviewer'])
    for row in rows:
        sheet.append([row[k] for k in ['number', 'id', 'verdict', 'risk', 'evidence', 'counterexample', 'suggested_fix', 'reviewer']])
    sheet.freeze_panes = 'A2'
    book.save(output / 'QC_53_REVIEW.xlsx')
    print(json.dumps({k: result[k] for k in ['status', 'completed', 'missing', 'invalid', 'verdicts']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'collect'])
    parser.add_argument('run')
    args = parser.parse_args()
    run = (ROOT / args.run).resolve()
    if not run.is_relative_to(ROOT / 'qc/runs'):
        raise ValueError('Run must be within qc/runs')
    (prepare if args.action == 'prepare' else collect)(run)

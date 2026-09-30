from pathlib import Path
import argparse, hashlib, json, sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, 'C:/Users/00518507/AppData/Local/Packages/PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0/LocalCache/local-packages/Python312/site-packages')
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument('--run', required=True, help='Existing prepared run, relative to workspace')
parser.add_argument('--evidence', required=True, help='Raw evidence index, relative to workspace')
args = parser.parse_args()
base = (root / args.run).resolve()
assert base.is_relative_to(root / 'qc/runs') and (base/'manifest.json').is_file()
out = base / 'per-row-review'
out.mkdir(exist_ok=True)
(out/'prompts').mkdir(exist_ok=True)
(out/'rows').mkdir(exist_ok=True)
manifest = json.loads((base/'manifest.json').read_text())
cache = root / manifest['cache']
checks = json.loads((base/'checklist.json').read_text())
assert len(checks['quality']) == 53
workbook = cache/'rules/WebDev Rubrics QC.xlsx'
wb = openpyxl.load_workbook(workbook, data_only=True)
sheets = {s.title: [[v for v in row] for row in s.iter_rows(values_only=True) if any(v is not None for v in row)] for s in wb.worksheets}
(out/'workbook-content.json').write_text(json.dumps(sheets, indent=2, default=str),encoding='utf-8')
for row in checks['quality']:
    n = row['number']
    prompt = f'''# Dedicated QC check {n:02d}: {row['id']}

The user explicitly requested ONE independent agent per quality row, replacing grouped review for this additional audit. Review ONLY this row, deeply, with any cross-file reads needed. This is not the older three-full-review assignment. Do not read other row reports or prior reviewer verdicts. Do not edit task source, rules, the prior reports, or golden logs. No paid calls, network requests, uploads, git writes, or new Docker runs.

Workspace root: {root.as_posix()}
Frozen task: {cache.relative_to(root).as_posix()}/task
Logical task name: colderwater-playground-devtools (the snapshot's folder is named task; that is not a task-identity defect).
Input SHA256: {manifest['input_sha256']}

Workbook check: {row['what']}

Read the frozen rules/harbor-webdev-rubric-qc/SKILL.md, the matching section in references/quality-checks.md and relevant staged-task-contract.md / deterministic-checks.md sections. Read qc/REVIEW_POLICY.md for current corrections, particularly independent outcome credit and missing runtime evidence. Use BOTH the actual frozen workbook and skill. Read your row from the actual XLSX with openpyxl, including its Internal annotation for interpretation. workbook-content.json is a convenient lossless extraction, not a substitute for inspecting the actual workbook. Internal annotations are interpretation only, not a replacement for the shipped profile.

For Python, use C:/Users/00518507/AppData/Local/Programs/Python/Python312/python.exe. The WindowsApps python alias cannot run in this sandbox. openpyxl is already installed under C:/Users/00518507/AppData/Local/Packages/PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0/LocalCache/local-packages/Python312/site-packages; add that path to sys.path or PYTHONPATH. Do not install anything.

Assess all relevant files, not one representative sample. Cite exact path:line or named section and quote concrete evidence. Try a conforming alternative that could be falsely failed, and a broken implementation that could falsely pass. Do not invent mandatory tech/UI details. Canonical harness/settings are frozen; identify a genuine inherited conflict rather than silently rewriting it. A generic heuristic match is not enough for Fail. Missing full configured judge runtime/Oracle/target model evidence remains unmeasured; scripted golden timing is not judge timing.

Raw evidence locations and hash bindings are listed in {args.evidence}. Verify relevant observations yourself; do not read prior reports summarizing their verdict. The manifest binds actual source. Source/parser checks may run read-only. Do not print secrets; if one is found identify its location and type with redacted evidence.

Save ONE JSON report to {out.relative_to(root).as_posix()}/rows/{n:02d}.json with:
- number: {n}, id: "{row['id']}", input_sha256: the hash above, reviewer: your unique agent name
- verdict: Pass / Fail / Note / N-A / Not exercised
- risk: true for a credible defect or required missing evidence; false otherwise
- severity: P0/P1/P2/P3 for defects, or null
- evidence: detailed string with concrete citations and observed results
- counterexample: actual plausible false-pass/false-fail witness, or null if none
- suggested_fix: bounded correction, measurement needed, or null
- run_verdict: CONFIRMED / REFUTED / PARTIAL / NOT EXERCISED
- sources_read: list of actual files and workbook sheet/row inspected

Return a short result identifying your check and any finding. Do not label all QC cleared. This is a review request, not authorization to fix the task.
'''
    (out/f'prompts/{n:02d}.md').write_text(prompt, encoding='utf-8')
(out/'assignment.json').write_text(json.dumps({'mode':'53 dedicated independent agents, at most3 active workers; latest user instruction overrides grouped review for this supplemental audit','input_sha256':manifest['input_sha256'],'workbook_sha256':hashlib.sha256(workbook.read_bytes()).hexdigest(),'task_source_edited':False,'checks':checks['quality']},indent=2),encoding='utf-8')
print(json.dumps({'directory':str(out),'prompts':len(checks['quality']),'workbook_sheets':list(sheets)}))

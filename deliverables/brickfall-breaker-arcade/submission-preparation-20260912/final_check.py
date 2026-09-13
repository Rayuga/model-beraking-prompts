import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from build_submission import HERE, OUT, ROOT, TASK, RUNS, TEMPLATES, JOBS, sha, tree_hashes, expected_names, load_evidence, w

audit_path = HERE / 'package-audit.json'
audit = json.loads(audit_path.read_text())
assert sorted(p.name for p in OUT.iterdir()) == expected_names()
assert tree_hashes(OUT) == audit['files']
assert tree_hashes(TASK) == audit['source_hashes']
assert {k: sha(p.read_bytes()) for k, p in TEMPLATES.items()} == audit['reference_document_hashes']
records, nop = load_evidence()
originals_checked = 0
for key, job_audit in audit['job_archives'].items():
    job_root = RUNS / JOBS[key][0]
    wrapper = job_audit['file'].removesuffix('.zip') + '/'
    redacted = {entry['path']: entry for entry in job_audit['redacted_files']}
    with zipfile.ZipFile(OUT / job_audit['file']) as z:
        assert z.testzip() is None
        assert {n: sha(z.read(n)) for n in z.namelist()} == job_audit['entry_hashes']
        for n in z.namelist():
            rel = n.removeprefix(wrapper)
            if rel in redacted:
                assert sha((job_root / rel).read_bytes()) == redacted[rel]['source_sha256']
            else:
                assert (job_root / rel).read_bytes() == z.read(n)
            originals_checked += 1

docs = []
word_validation = {d['file']: d for d in json.loads((HERE / 'word-validation.json').read_text())}
for p in sorted(OUT.glob('*.docx')):
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        xml = ET.fromstring(z.read('word/document.xml'))
        text = ' '.join(t.text or '' for t in xml.iter(w('t')))
        assert '0.9583' in text and '0.6094' in text
        assert '0.1689' in text and 'replacement pending' not in text
        assert 'run-8e4c12dd' in text and '6uqBDww' in text
        assert 'run-05fd6dc8' in text
        assert 'DrawBill' not in text and 'drawbill' not in text
        if p.name.startswith('EVAL-REPORT'):
            for d in records['oracle']['details'].values():
                if isinstance(d, dict):
                    for c in d.get('criteria', []):
                        assert c['id'].replace('_', ' ') in text
            normalized = ' '.join(text.split())
            for dim in ['constraints', 'functional', 'polish']:
                for c in records['claude-haiku-4.5']['details'][dim]['criteria']:
                    if c['value'] == 0:
                        assert ' '.join(c['reasoning'].split()) in normalized
    pdf = HERE / (p.stem + '.pdf')
    assert pdf.exists() and pdf.read_bytes().startswith(b'%PDF')
    docs.append(dict(file=p.name, sha256=sha(p.read_bytes()), word_opened=True,
                     pdf=pdf.name, pdf_sha256=sha(pdf.read_bytes()),
                     pages=word_validation[p.name]['pages']))

audit['final_validation'] = {
    'passed': True,
    'original_run_files_checked_against_job_archives': originals_checked,
    'all_40_criteria_present_in_eval_report': True,
    'documents': docs,
    'delivery_has_only_the_requested_seven_files': True,
    'task_and_reference_files_unchanged': True,
    'pending_item': None,
    'completed_haiku_included': records['claude-haiku-4.5']['rewards']['reward'] == .1689,
    'latest_haiku_trial': records['claude-haiku-4.5']['result']['trial_name'],
    'latest_haiku_failed_verdicts_match_report': True,
    'word_validation_note': 'Read-only Microsoft Word opening and PDF export passed after fixing an undefined compatibility namespace in styles.xml. Failed drafts preserved under word-attempt-1. PowerShell COM attempts failed; native VBScript automation succeeded.',
}
audit_path.write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
print(json.dumps(audit['final_validation'], indent=2))

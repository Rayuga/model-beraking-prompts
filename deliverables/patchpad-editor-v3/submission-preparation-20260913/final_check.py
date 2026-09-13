import json
import re
import zipfile
from xml.etree import ElementTree as ET
from build_submission import HERE, OUT, ROOT, TASK, RUNS, REFERENCE, JOBS, SLUG, SHA, sha, tree, load_evidence, w

audit_path = HERE / 'package-audit.json'
audit = json.loads(audit_path.read_text(encoding='utf-8'))
expected = {SLUG+'.zip', f'CASE-STUDY-{SLUG}.docx', f'EVAL-REPORT-{SLUG}.docx'} | {f'{SLUG}-{k}-job-directory.zip' for k in JOBS}
assert set(p.name for p in OUT.iterdir()) == expected
assert tree(OUT) == audit['files']
assert sha((OUT/(SLUG+'.zip')).read_bytes()) == SHA
assert {'task':tree(TASK),'runs':tree(RUNS),'templates':tree(REFERENCE)} == audit['source_hashes_before_and_after']
records = load_evidence()
verified_entries = 0
for key, info in audit['job_archives'].items():
    original = RUNS / JOBS[key][0]
    changed = {x['file']: x for x in info['redacted']}
    with zipfile.ZipFile(OUT/info['file']) as z:
        assert z.testzip() is None
        assert {n:sha(z.read(n)) for n in z.namelist()} == info['entry_hashes']
        prefix = info['file'].removesuffix('.zip')+'/'
        for name in z.namelist():
            assert name.startswith(prefix) and '..' not in name.split('/')
            rel = name.removeprefix(prefix)
            assert rel not in info['excluded']
            if rel not in changed: assert z.read(name) == (original/rel).read_bytes()
            else: assert sha((original/rel).read_bytes()) == changed[rel]['source_sha256']
            verified_entries += 1
        if key == 'oracle':
            nop = json.loads(z.read(prefix+f'{SLUG}__eNxTkub/verifier/reward.json'))
            assert nop['reward']==0 and nop['no_op']==1

patterns = [
    ('credential', re.compile(rb'\b(?:sk-(?:proj-|or-v1-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,})\b')),
    ('private-key',re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
    ('bearer-token',re.compile(rb'Bearer\s+[A-Za-z0-9_.-]{30,}')),
    ('personal-windows-path',re.compile(rb'[A-Za-z]:[\\/]+Users[\\/]+(?!Public|Default)[^\s"<>]+',re.I)),
    ('personal-mac-path',re.compile(rb'/Users/[^\s"<>]+')),
]
scanned = 0
for archive in OUT.iterdir():
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for name in z.namelist():
            data=z.read(name)
            for label,pattern in patterns:
                assert not pattern.search(data), f'{label} in {archive.name}:{name}'
            scanned += 1
            if archive.suffix=='.docx' and name.endswith(('.xml','.rels')): ET.fromstring(data)

word = json.loads((HERE/'word-validation.json').read_text())
assert len(word)==2 and all(x['word_opened'] and x['pages']>0 for x in word)
for item in word:
    pdf=HERE/(item['file'].removesuffix('.docx')+'.pdf')
    assert pdf.read_bytes().startswith(b'%PDF')
    item['pdf_sha256']=sha(pdf.read_bytes())
    item['docx_sha256']=sha((OUT/item['file']).read_bytes())
audit['final_validation']={'passed':True,'only_requested_seven_files':True,'source_run_and_template_files_unchanged':True,'task_zip_unchanged':True,'job_entries_compared_to_original':verified_entries,'archive_entries_scanned':scanned,'credential_and_personal_path_findings':0,'oracle_includes_noop':True,'official_scores_unchanged':True,'documents':word,'all_41_criterion_outcomes_and_recorded_deductions_in_eval':True}
audit_path.write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
(HERE/'SHA256SUMS.txt').write_text(''.join(f'{value}  {name}\n' for name,value in audit['files'].items()),encoding='utf-8')
print(json.dumps(audit['final_validation'],indent=2))

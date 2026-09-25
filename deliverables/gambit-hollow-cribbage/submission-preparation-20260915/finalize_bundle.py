from pathlib import Path
import hashlib
import json
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SLUG = 'gambit-hollow-cribbage'
OUT = HERE.parent / 'final-submission-20260915'
BUNDLE = HERE.parent / f'{SLUG}-final-deliverables.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
audit = json.loads((HERE / 'package-audit.json').read_text(encoding='utf-8'))
render = json.loads((HERE / 'document-render-check.json').read_text(encoding='utf-8'))
assert len(render['documents']) == 2
assert all(d['opened_and_rendered'] and d['nonempty_pages'] and not d['out_of_page_text_blocks'] for d in render['documents'])
files = {p.name: p.read_bytes() for p in OUT.iterdir() if p.is_file()}
assert len(files) == 7
assert {n: sha(data) for n, data in files.items()} == audit['files']
source = ROOT / 'projects' / SLUG
assert {p.relative_to(source).as_posix(): sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()} == audit['source_hashes']
for item in audit['job_archives'].values():
    assert not item['redacted_files'] and not item['excluded']
    with zipfile.ZipFile(OUT / item['file']) as z:
        assert z.testzip() is None
        entries = {n.split('/', 1)[1]: z.read(n) for n in z.namelist()}
        candidates = [p for p in (ROOT / 'run-outputs' / SLUG).glob('run-*') if (p / 'result.json').read_bytes() == entries['result.json']]
        assert len(candidates) == 1
        run = candidates[0]
        raw = {p.relative_to(run).as_posix(): p.read_bytes() for p in run.rglob('*') if p.is_file()}
        assert raw == entries, item['file']
assert not BUNDLE.exists(), 'Preserve existing bundles.'
with zipfile.ZipFile(BUNDLE, 'x', zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        item = zipfile.ZipInfo(BUNDLE.stem + '/' + name, (2026, 9, 15, 0, 0, 0))
        item.create_system = 3
        item.external_attr = 0o100644 << 16
        item.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(item, data)
with zipfile.ZipFile(BUNDLE) as z:
    assert z.testzip() is None
    assert {n.split('/', 1)[1]: z.read(n) for n in z.namelist()} == files
bundle_hash = sha(BUNDLE.read_bytes())
BUNDLE.with_suffix('.zip.sha256').write_text(bundle_hash + '  ' + BUNDLE.name + '\n', encoding='ascii')
summary = dict(bundle=str(BUNDLE.relative_to(ROOT)), bundle_sha256=bundle_hash, bytes=BUNDLE.stat().st_size, deliverable_count=7, files=audit['files'], documents_rendered=True, document_pages={d['document']: d['pdf_pages'] for d in render['documents']}, all_run_files_byte_identical=True, source_unchanged=True, task_zip_unchanged=True, task_archive_checks=audit['archive_checks'], standard_checks=audit['standard_checks'], caveats=['Haiku agent exit 143 retained', 'No Sonnet export supplied', 'Oracle Visual 0.9167', 'Gemini overall 0.8134', 'No platform QC report supplied'])
(HERE / 'bundle-audit.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))

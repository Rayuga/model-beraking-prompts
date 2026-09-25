"""Validate rendered reports and assemble the seven-file download bundle."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import zipfile
import fitz

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SLUG = 'common-ground-ballot'
OUT = HERE.parent / 'final-submission-20260917'
BUNDLE = HERE.parent / f'{SLUG}-final-deliverables.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
audit = json.loads((HERE / 'package-audit.json').read_text())
observations = json.loads((HERE / 'word-render-observations.json').read_text(encoding='utf-8-sig'))
assert len(observations) == 2
documents = []
for observation in observations:
    path = Path(observation['pdf'])
    pdf = fitz.open(path)
    assert observation['opened_and_rendered'] and len(pdf) == observation['pages']
    outside, empty = [], []
    text = ''
    previews = {0, len(pdf) - 1}
    for i, page in enumerate(pdf):
        content = page.get_text()
        text += content
        if len(content.strip()) < 80:
            empty.append(i + 1)
        if 'All 86 criterion outcomes' in content:
            previews.add(i)
            if i + 1 < len(pdf): previews.add(i + 1)
        for block in page.get_text('blocks'):
            x0, y0, x1, y1 = block[:4]
            if x0 < -1 or y0 < -1 or x1 > page.rect.width + 1 or y1 > page.rect.height + 1:
                outside.append({'page': i + 1, 'bbox': [x0, y0, x1, y1]})
    assert not outside and not empty, (path.name, outside, empty)
    assert all(value in text for value in ['0.5788', '1.0000', '0.3357', '0.9286', '0.9583'])
    for i in sorted(previews):
        pdf[i].get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False).save(HERE / 'rendered' / f'{path.stem}-page-{i+1}.png')
    documents.append(dict(document=observation['document'], pdf_pages=len(pdf), words=observation['words'], opened_and_rendered=True, nonempty_pages=True, out_of_page_text_blocks=outside, preview_pages=[i+1 for i in sorted(previews)]))
(HERE / 'document-render-check.json').write_text(json.dumps({'documents': documents}, indent=2) + '\n')

files = {p.name: p.read_bytes() for p in OUT.iterdir() if p.is_file()}
assert len(files) == 7 and {n: sha(data) for n, data in files.items()} == audit['files']
source = ROOT / 'projects' / SLUG
assert {p.relative_to(source).as_posix(): sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()} == audit['source_hashes']
assert sha(files[f'{SLUG}.zip']) == audit['task_zip_sha256']
run_files = 0
for item in audit['job_archives'].values():
    source = ROOT / 'run-outputs' / SLUG / item['original_run']
    original = {p.relative_to(source).as_posix(): sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()}
    assert original == item['source_hashes']
    with zipfile.ZipFile(OUT / item['file']) as z:
        assert z.testzip() is None
        assert {n: sha(z.read(n)) for n in z.namelist()} == item['entry_hashes']
        packaged = {n.split('/', 1)[1]: sha(z.read(n)) for n in z.namelist()}
        assert set(packaged) == set(original)
        for name in original:
            if name not in item['redacted_files']:
                assert original[name] == packaged[name]
        assert not item['excluded']
        run_files += len(packaged)
assert not BUNDLE.exists(), 'Preserve existing bundles.'
with zipfile.ZipFile(BUNDLE, 'x', zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(BUNDLE.stem + '/' + name, (2026, 9, 17, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
with zipfile.ZipFile(BUNDLE) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist())) == 7
    assert all(not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts for n in z.namelist())
    assert {n.split('/', 1)[1]: z.read(n) for n in z.namelist()} == files
bundle_hash = sha(BUNDLE.read_bytes())
BUNDLE.with_suffix('.zip.sha256').write_text(bundle_hash + '  ' + BUNDLE.name + '\n', encoding='ascii')
summary = dict(bundle=str(BUNDLE.relative_to(ROOT)), bundle_sha256=bundle_hash, bytes=BUNDLE.stat().st_size, deliverable_count=7, files=audit['files'], documents_rendered=True, document_pages={d['document']: d['pdf_pages'] for d in documents}, run_files_preserved=run_files, all_run_files_byte_identical=not any(item['redacted_files'] for item in audit['job_archives'].values()), source_unchanged=True, task_zip_unchanged=True, recorded_scores=audit['recorded_scores'], caveats=['Oracle/NOP are reused exports, not second executions', 'No separate platform QC report supplied', 'One current sample per model', 'No Sonnet export supplied'])
(HERE / 'bundle-audit.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))

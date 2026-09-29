"""Read-only binding of shipped verifier files in the final local image."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import os

root = Path('/workspace')
review = root / 'deliverables/colderwater-playground-devtools/structural-review-2026-09-27'
manifest = json.loads((review / 'staged_candidate.json').read_text())
expected = {name[len('tests/'):]: digest for name, digest in manifest['source_sha256'].items() if name.startswith('tests/') and name not in ['tests/Dockerfile', 'tests/.dockerignore']}
actual = {p.relative_to('/tests').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}
checks = [{'file': name, 'expected': digest, 'actual': actual.get(name), 'passed': actual.get(name) == digest} for name, digest in sorted(expected.items())]
report = {
    'scope': 'Verifier image file/version binding only; no app, browser or provider execution.',
    'image_tag': 'colderwater-verifier:20260927-structural',
    'image_id': os.environ.get('CW_AUDIT_IMAGE_ID'),
    'rewardkit_version': importlib.metadata.version('harbor-rewardkit'),
    'manifest_sha256': hashlib.sha256((review / 'staged_candidate.json').read_bytes()).hexdigest(),
    'expected_count': len(expected), 'actual_count': len(actual),
    'unexpected_files': sorted(set(actual) - set(expected)),
    'checks': checks,
    'passed': len(expected) == 15 and set(actual) == set(expected) and all(c['passed'] for c in checks),
    'network': 'Docker --network none', 'provider_calls': 0,
}
Path('/evidence/final_verifier_image.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['image_tag', 'image_id', 'rewardkit_version', 'expected_count', 'actual_count', 'unexpected_files', 'passed']}))
assert report['passed'], report

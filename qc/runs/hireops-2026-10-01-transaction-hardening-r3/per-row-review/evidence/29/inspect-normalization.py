"""Read and exercise the installed Likert class without package/provider import."""
import ast
import hashlib
import json
from pathlib import Path

path = Path('/usr/local/lib/python3.12/site-packages/rewardkit/models.py')
source = path.read_bytes()
tree = ast.parse(source, filename=str(path))
likert = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'Likert')
module = ast.Module(body=[ast.ImportFrom(module='pydantic', names=[ast.alias(name='BaseModel'), ast.alias(name='ConfigDict')], level=0), likert], type_ignores=[])
ast.fix_missing_locations(module)
namespace = {}
exec(compile(module, str(path), 'exec'), namespace)
model = namespace['Likert'](points=5)
print(json.dumps({
    'scope': 'Cached-image installed normalization only; not a configured judge or private checker run',
    'input_sha256': 'cf784fd80eb2bbde1fc76bc223bc4dd9b75279121566847079f982e09473ca01',
    'installed_source': str(path),
    'installed_source_sha256': hashlib.sha256(source).hexdigest(),
    'class_start_line': likert.lineno,
    'class_end_line': likert.end_lineno,
    'class_source': ast.get_source_segment(source.decode(), likert),
    'points': model.points,
    'normalized': {str(raw): model.normalize(raw) for raw in range(1, 6)},
}, indent=2))

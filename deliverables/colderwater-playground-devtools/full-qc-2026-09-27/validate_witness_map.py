import hashlib
import json
import tomllib
from pathlib import Path
from collections import Counter

base = Path('deliverables/colderwater-playground-devtools/full-qc-2026-09-27')
task = Path('projects/colderwater-playground-devtools')
manifest = json.loads((base / 'candidate_manifest.json').read_text())
mapping = json.loads((base / 'GOLDEN_CRITERION_EVIDENCE.json').read_text())
assert mapping['archive_sha256'] == manifest['sha256']
expected = {}
for rel, digest in mapping['rubric_sha256'].items():
    assert hashlib.sha256((task/rel).read_bytes()).hexdigest() == digest == manifest['source_sha256'][rel]
    dimension = str(Path(rel).parent).replace('\\','/').removeprefix('tests/')
    for criterion in tomllib.loads((task/rel).read_text())['criterion']:
        expected[criterion['id']] = (dimension, criterion['type'], criterion['weight'])
assert len(expected) == 45
assert len(mapping['criteria']) == len({x['id'] for x in mapping['criteria']}) == 45
assert set(expected) == {x['id'] for x in mapping['criteria']}
artifact_hashes = {}
for item in mapping['criteria']:
    assert expected[item['id']] == (item['dimension'], item['type'], item['weight'])
    assert item['evidence'] and item['observations']
    for rel in item['evidence']:
        p=base/rel
        assert p.is_file(), rel
        artifact_hashes[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
        if p.suffix == '.json':
            json.loads(p.read_text())
for name in ['actual-mcp-results.json','large-controls-mcp-results.json','presentation-final/presentation-results.json','final-runtime-details.json','restart-full/restart-witness-results.json','installer/oracle-reinstall-results.json']:
    assert json.loads((base/name).read_text())['passed'] is True
result = {'passed':True,'scope':'Independent exact mapping/hash/path validation plus separately documented manual evidence review; not a paid verdict or exhaustive semantic proof from JSON existence.','archive_sha256':manifest['sha256'],'criteria':45,'counts':dict(Counter(x['dimension'] for x in mapping['criteria'])),'five_rubric_hashes_match':True,'exact_ids_types_weights_match':True,'evidence_hashes':artifact_hashes,'paid_oracle_measured':False}
(base/'witness_map_validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='evidence_hashes'}))

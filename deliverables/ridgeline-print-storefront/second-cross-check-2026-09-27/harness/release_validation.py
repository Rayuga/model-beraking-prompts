"""Independent archive and actual-image reads; no judge/application mutations."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import subprocess
import zipfile

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
ROOT = HERE.parents[3]
TASK = ROOT/'projects/ridgeline-print-storefront'
OLD = ROOT/'deliverables/ridgeline-print-storefront/cross-check-2026-09-27'
read = lambda p:json.loads(p.read_text(encoding='utf-8'))
sha = lambda data:hashlib.sha256(data).hexdigest()
manifest = read(OUT/'candidate_manifest.json')
images = read(OUT/'final_image_evidence.json')
archive = OUT/manifest['archive']
assert sha(archive.read_bytes()) == manifest['sha256'] == 'e9571f7ec27341ace6c955a81de5cc8fd2199df804ee54b7c90a009b18333f9b'
assert archive.stat().st_size == manifest['bytes']
def archive_hashes(path):
    with zipfile.ZipFile(path) as zipped:
        assert zipped.testzip() is None
        infos = [i for i in zipped.infolist() if not i.is_dir()]
        assert len({i.filename for i in infos}) == len(infos)
        values = {}
        for item in infos:
            p = PurePosixPath(item.filename)
            assert p.parts[0] == TASK.name and '..' not in p.parts and not p.is_absolute()
            rel = p.relative_to(TASK.name).as_posix()
            values[rel] = sha(zipped.read(item))
            if rel.endswith('.sh'):
                assert (item.external_attr >> 16) & 0o111
        return values
current = archive_hashes(archive)
old = archive_hashes(OLD/'ridgeline-print-storefront.zip')
assert len(current) == manifest['files'] == 51
source = {p.relative_to(TASK).as_posix():sha(p.read_bytes()) for p in TASK.rglob('*') if p.is_file()}
assert current == source == manifest['source_sha256']
extracted = OUT/f'archive-check-{manifest["sha256"][:12]}'/TASK.name
assert {p.relative_to(extracted).as_posix():sha(p.read_bytes()) for p in extracted.rglob('*') if p.is_file()} == current
golden = {p:v for p,v in current.items() if p.startswith('solution/')}
assert len(golden) == 19 and golden == {p:v for p,v in old.items() if p.startswith('solution/')}
assert current['tests/test.sh'] == '7644e994deefad7ce60ca93d20e4c7c5313df31ef70238689a044ef893c4ebbb'
assert images['passed']
for p,digest in images['source_before_build'].items():
    assert current[p] == digest, p
tags, ids = {}, {}
for build in images['builds']:
    actual = subprocess.check_output(['docker','image','inspect',build['tag'],'--format','{{.Id}}'],text=True).strip()
    assert actual == build['image_id']
    tags[build['role']], ids[build['role']] = build['tag'], actual
verifier_code = "from pathlib import Path;import hashlib,json;print(json.dumps({p.relative_to('/tests').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}))"
verifier = json.loads(subprocess.check_output(['docker','run','--rm','--name','ridgeline-second-release-verifier','--network','none',tags['verifier'],'python3','-B','-c',verifier_code],text=True))
assert len(verifier) == 15 and verifier == images['verifier_source_hashes']
for p,digest in verifier.items():
    assert current['tests/'+p] == digest,p
agent_code = "const fs=require('fs'),c=require('crypto');const files={};function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())walk(q);else files[q]=c.createHash('sha256').update(fs.readFileSync(q)).digest('hex');}}walk('/instructions');walk('/assets');console.log(JSON.stringify({files,app:fs.readdirSync('/app').sort(),privatePresent:['/solution','/tests','/app/server.js'].some(p=>fs.existsSync(p))}));"
agent = json.loads(subprocess.check_output(['docker','run','--rm','--name','ridgeline-second-release-agent','--network','none',tags['agent'],'node','-e',agent_code],text=True))
assert len(agent['files']) == 12 and agent['app'] == ['.git','.gitkeep'] and not agent['privatePresent']
for p,digest in agent['files'].items():
    assert current['environment'+p] == digest,p
binding = read(HERE/'review_binding.json')
assert binding['passed'] and binding['current_test_sh_sha256'] == current['tests/test.sh']
for p,digest in binding['evidence_sha256'].items():
    assert sha((ROOT/p).read_bytes()) == digest,p
for name in ['cleanup_fixed_probe_results.json','orchestration_regression_results.json']:
    evidence=read(HERE/name)
    assert evidence['passed'] and evidence['test_sh_sha256'] == current['tests/test.sh']
report={'passed':True,'scope':'Independent actual archive/source/extracted/image reads. No paid judging.',
        'archive_sha256':manifest['sha256'],'files':len(current),'bytes':manifest['bytes'],
        'source_archive_manifest_extracted_equal':True,'golden_files_unchanged':len(golden),
        'changed_from_9944734':sorted(p for p in current if current[p] != old[p]),
        'test_sh_sha256':current['tests/test.sh'],'functional_judge_sha256':current['tests/scored/functional/judge.toml'],
        'actual_image_ids':ids,'actual_verifier_hashes':verifier,'actual_agent_inputs':agent['files'],
        'agent_app':agent['app'],'source_sha256':current}
(OUT/'release_validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ['passed','archive_sha256','files','bytes','golden_files_unchanged','changed_from_9944734','test_sh_sha256','actual_image_ids']},indent=2))

"""Independent final archive/source/image binding, no application/judge run."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import subprocess
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root/'projects/ridgeline-print-storefront'
manifest = json.loads((out/'candidate_manifest.json').read_text())
images = json.loads((out/'final_image_evidence.json').read_text())
archive = out/manifest['archive']
sha = lambda value:hashlib.sha256(value).hexdigest()
assert sha(archive.read_bytes()) == manifest['sha256'] == '9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c'
assert archive.stat().st_size == manifest['bytes'] == 701173
def archive_map(path):
    with zipfile.ZipFile(path) as zipped:
        assert zipped.testzip() is None
        infos = [item for item in zipped.infolist() if not item.is_dir()]
        assert len({item.filename for item in infos}) == len(infos)
        values = {}
        for item in infos:
            p = PurePosixPath(item.filename)
            assert p.parts[0]=='ridgeline-print-storefront' and '..' not in p.parts and not p.is_absolute()
            rel = p.relative_to('ridgeline-print-storefront').as_posix()
            values[rel] = sha(zipped.read(item))
            if rel.endswith('.sh'):
                assert (item.external_attr>>16)&0o111
        return values
current = archive_map(archive)
assert len(current) == manifest['files'] == 51
source = {p.relative_to(task).as_posix():sha(p.read_bytes()) for p in task.rglob('*') if p.is_file()}
assert current == source == manifest['source_sha256']
extracted = out/'archive-check-9944734b6513'/'ridgeline-print-storefront'
assert extracted.is_dir(),extracted
assert {p.relative_to(extracted).as_posix():sha(p.read_bytes()) for p in extracted.rglob('*') if p.is_file()} == source
baseline = out.parent/'rubric-followup-2026-09-26'/'ridgeline-print-storefront.zip'
old = archive_map(baseline)
assert old.keys()==current.keys()
changed = sorted(p for p in current if current[p]!=old[p])
assert changed == sorted(['task.toml','tests/test.sh','tests/scored/functional/judge.toml','tests/scored/functional/prompt.md','tests/scored/polish/judge.toml','tests/scored/polish/prompt.md']),changed
assert source['tests/test.sh'] == 'd983554cf01740acf24ba35f376181983a10c6a926315860123f382644eef6b1'
for relative,digest in images['source_before_build'].items():
    assert current[relative] == digest,relative

image_ids = {}
for build in images['builds']:
    inspected = subprocess.run(['docker','image','inspect',build['tag'],'--format','{{.Id}}'],check=True,text=True,capture_output=True).stdout.strip()
    assert inspected == build['image_id']
    image_ids[build['role']] = inspected

verifier_code = "from pathlib import Path;import hashlib,json;print(json.dumps({p.relative_to('/tests').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}))"
verifier = json.loads(subprocess.run(['docker','run','--rm','--name','ridgeline-qc-image-bind-verifier','--network','none','ridgeline-verifier:20260927-crosscheck','python3','-c',verifier_code],check=True,text=True,capture_output=True).stdout)
assert verifier == images['verifier_source_hashes']
assert len(verifier)==15
for path,digest in verifier.items():
    assert current['tests/'+path]==digest
agent_code = "const fs=require('fs'),crypto=require('crypto');const files={};function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())walk(q);else files[q]=crypto.createHash('sha256').update(fs.readFileSync(q)).digest('hex');}}walk('/instructions');walk('/assets');console.log(JSON.stringify({files,app:fs.readdirSync('/app').sort(),privatePresent:['/solution','/tests','/app/server.js'].some(p=>fs.existsSync(p))}));"
agent = json.loads(subprocess.run(['docker','run','--rm','--name','ridgeline-qc-image-bind-agent','--network','none','ridgeline-agent:20260927-crosscheck','node','-e',agent_code],check=True,text=True,capture_output=True).stdout)
assert len(agent['files'])==12 and not agent['privatePresent'] and agent['app']==['.git','.gitkeep']
for path,digest in agent['files'].items():
    assert current['environment'+path] == digest,path
for name in ['restart_fixed_probe_results.json','harness_regression_results.json']:
    result=json.loads((out/name).read_text())
    assert result['passed'] and result['test_sh_sha256']==current['tests/test.sh']
browser=json.loads((out/'browser_restart_results.json').read_text())
for path,digest in browser['current_source_sha256'].items():
    assert current[path]==digest,path
report={'passed':True,'archive':manifest['archive'],'archive_sha256':manifest['sha256'],'bytes':manifest['bytes'],'files':len(current),
        'source_manifest_extracted_archive_hashes_equal':True,'changed_paths_vs_7502':changed,
        'test_sh_sha256':current['tests/test.sh'],'actual_image_ids':image_ids,
        'actual_agent_public_hashes':agent['files'],'actual_agent_app':agent['app'],
        'actual_verifier_hashes':verifier,'test_and_browser_evidence_hashes_match':True,
        'scope':'Fresh independent archive/source/extracted and actual final-image hash verification. No paid judge.'}
(out/'independent_harness_binding.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({key:report[key] for key in ['passed','archive_sha256','bytes','files','changed_paths_vs_7502','test_sh_sha256','actual_image_ids']},indent=2))

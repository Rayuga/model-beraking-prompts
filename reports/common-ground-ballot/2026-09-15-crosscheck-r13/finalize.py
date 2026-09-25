import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
DELIVERY=ROOT/'deliverables/common-ground-ballot/2026-09-15-crosscheck-r13'
manifest=json.loads((OUT/'freeze-manifest.json').read_text(encoding='utf-8'))
archive=DELIVERY/'common-ground-ballot.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==manifest['sha256']
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        data=z.read(name)
        assert data==(OUT/'frozen'/name).read_bytes()
        assert data==(ROOT/'projects'/name).read_bytes()
groups={'browser':45,'runtime':5,'harness':15,'session':7,'mcp':13}
for mode,count in groups.items():
    result=json.loads((OUT/('validation-'+mode)/(mode+'-results.json')).read_text(encoding='utf-8'))
    assert len(result['results'])==count and all(r['passed'] for r in result['results']),mode
    if mode=='browser':assert result['errors']==[]
variants=json.loads((OUT/'mcp-variant-results.json').read_text(encoding='utf-8'))
assert len(variants['results'])==3 and all(r['detected'] for r in variants['results'])
provenance=json.loads((OUT/'validation-harness/prompt-provenance.json').read_text(encoding='utf-8'))
for dim in ['render','constraints','functional','polish','visual']:
    for key,file in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]:
        assert provenance['judges'][dim][key]==hashlib.sha256((OUT/'frozen/common-ground-ballot/tests'/dim/file).read_bytes()).hexdigest()
hashes={p.relative_to(OUT/'frozen/common-ground-ballot/environment').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['instructions','assets'] for p in (OUT/'frozen/common-ground-ballot/environment'/folder).rglob('*') if p.is_file()}
(OUT/'agent-expected-hashes.json').write_text(json.dumps(hashes),encoding='utf-8')
agent=subprocess.run(['docker','run','--rm','--network','none','--mount',f'type=bind,source={OUT},target=/validation,readonly','ballot-agent:20260915-r13-local','node','/validation/agent-smoke.cjs'],capture_output=True,text=True,check=True)
(OUT/'agent-smoke-results.json').write_text(agent.stdout,encoding='utf-8')
images={tag:json.loads(subprocess.check_output(['docker','image','inspect',tag],text=True))[0]['Id'] for tag in ['ballot-agent:20260915-r13-local','ballot-verifier:20260915-r13-local']}
(OUT/'image-hashes.json').write_text(json.dumps(images,indent=2)+'\n',encoding='utf-8')
audit={**manifest,'local_groups':groups,'negative_variants_detected':3,'standard_checks':115,'archive_checks':317,'tested_frozen_archive_bytes':True,'cached_dependency_assembly_passed':True,'clean_build_passed':False,'fresh_scored_oracle':False,'fresh_gpt':False,'platform_qc':False}
(OUT/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
for name in ['README.md','package-audit.json','freeze-manifest.json','source-hashes.json','changes.diff','check-standard.json','check-upload.json','mcp-variant-results.json','image-hashes.json','agent-smoke-results.json']:
    shutil.copyfile(OUT/name,DELIVERY/name)
shutil.copyfile(OUT/'validation-harness/prompt-provenance.json',DELIVERY/'prompt-provenance.json')
shutil.copyfile(OUT/'validation-mcp/mcp-results.json',DELIVERY/'mcp-results.json')
shutil.copyfile(ROOT/'deliverables/common-ground-ballot/2026-09-14-oracle-repair-r12/coverage.json',DELIVERY/'coverage.json')
context=ROOT/'TASK_AUTHORING_CONTEXT.md'
content=context.read_text(encoding='utf-8')
heading='## September 15: Ballot MCP Cross-check r13'
if heading not in content:
    entry=f'''\n{heading}

The user requested another cross-check to avoid another Oracle failure.
Current Ballot ZIP: `{manifest['archive']}`.
SHA256 `{manifest['sha256']}`.
Read `reports/common-ground-ballot/2026-09-15-crosscheck-r13/README.md`.

The actual pinned Playwright MCP 0.0.79 check exposed native-confirmation
interruption: a combined End all sessions snippet returned Modal state before
its result was retained. The Functional r13 prompt now splits capture, click,
dialog handling, revocation measurements and fresh sign-in into separate calls,
preserves process-owned capture across calls, and keeps the primary context.
It also removes Courtyard-only replay ambiguity, splits immediate privacy and
approval checkpoints, and explicitly repeats the full approval mismatch and
both successful replays at publication and each restart. Only the Functional
prompt changed from r12. Golden, criteria, weights, gates and config are unchanged.

The exact frozen ZIP passes 45 browser groups, seven focused session groups,
13 groups through actual MCP with two real restarts, five runtime checks,
15 harness cases, 115 standard and 317 ZIP checks. Three broken variants are
detected via MCP, including a server session retained after its browser cookie
is cleared. No scored r13 Oracle/GPT or platform QC result exists. Harbor is
unauthenticated and direct OpenAI judge credentials are absent. Passing local
runtime evidence uses current frozen files with cached dependencies; clean
builds were attempted again and the configured package proxy remains blocked.
The original platform session failure's exact cause is still unproven without
the missing action trace. Run platform Oracle, then GPT, on this same checksum.
'''
    content=content.replace('# Current WebDev Task Authoring Context\n','# Current WebDev Task Authoring Context\n'+entry,1)
    context.write_text(content,encoding='utf-8',newline='\n')
print(json.dumps(audit,indent=2))

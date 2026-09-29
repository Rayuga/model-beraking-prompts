"""Bind fresh final schema fixtures and source/archive facts; no provider calls."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--manifest',required=True,type=Path)
parser.add_argument('--archive',required=True,type=Path)
args=parser.parse_args()
review=Path(__file__).resolve().parents[1]
old=review.parent/'positive-controls-fix-2026-09-27'
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=load(args.manifest)
main=load(review/'source_audit_main.json')
extracted=load(review/'source_audit_archive.json')
payload=load(review/'harness/payload_results.json')
baseline,current=payload['results']
cli=load(review/'harness/schema_cli_results.json')
mapping=load(review/'semantics/decomposition-map.json')
prior=load(old/'qc_final_findings.json')
checks=[]
def check(name,passed,evidence):checks.append({'name':name,'passed':bool(passed),'evidence':evidence})
archive_hash=sha(args.archive)
check('archive fingerprint matches manifest',archive_hash==manifest['sha256'],archive_hash)
check('fresh source and extracted mechanical audits pass',main['failed']==extracted['failed']==0 and main['passed']==extracted['passed']==95,{'main':main['passed'],'extracted':extracted['passed']})
check('all source and extracted hashes match manifest',main['source_hashes']==extracted['source_hashes']==manifest['source_sha256'] and len(main['source_hashes'])==50,50)
with zipfile.ZipFile(args.archive) as z:
    names=[n for n in z.namelist() if not n.endswith('/')]
    matches=[]
    for relative,expected in manifest['source_sha256'].items():
        found=[n for n in names if n==relative or n.endswith('/'+relative)]
        matches.append(len(found)==1 and hashlib.sha256(z.read(found[0])).hexdigest()==expected)
    check('archive CRC and exact file inventory',z.testzip() is None and len(names)==len(matches)==50 and all(matches),{'files':len(names),'matched':sum(matches)})
semantic={'judge':'tests/scored/functional/judge.toml','prompt':'tests/scored/functional/prompt.md','context':'tests/app_context.md'}
check('final installed payload binds all semantic files',all(current[k+'_sha256']==manifest['source_sha256'][p] for k,p in semantic.items()),{k:current[k+'_sha256'] for k in semantic})
check('baseline comparison binds reviewed 663e archive',all(baseline[k+'_sha256']==prior['candidate']['source_sha256'][p] for k,p in semantic.items()) and prior['candidate']['sha256']=='663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e',prior['candidate']['sha256'])
check('final prompt and schema locally launch',payload['candidate_launch_passed'],{'prompt_bytes':current['resolved_prompt_utf8_bytes'],'schema_bytes':current['response_schema_utf8_bytes']})
check('fresh actual CLI cases bind exact new inventory and semantic files',cli['passed'] and cli['version']=='0.1.7' and len(cli['results'])==3 and cli['functional_count']==current['rows']==mapping['atomic_count']==main['counts']['functional']['criteria'] and all(cli['binding'][k+'_sha256']==current[k+'_sha256'] for k in semantic),{'rows':cli['functional_count'],'results':cli['results'],'scope':'Local transport/serialization/aggregation only; no product/model/Oracle judgment.'})
transport=[]
for case in cli['results']:
    trace=review/'harness/schema-cli'/case['case']/'transport.jsonl'
    rows=[json.loads(line) for line in trace.read_text().splitlines() if line]
    observed=[r for r in rows if r['rows']==current['rows']]
    transport.append({'case':case['case'],'trace_sha256':sha(trace),'matches':len(observed)==1 and observed[0]['prompt_sha256']==current['resolved_prompt_sha256'] and observed[0]['prompt_bytes']==current['resolved_prompt_utf8_bytes'] and observed[0]['schema_bytes']==current['response_schema_utf8_bytes']})
check('actual CLI transports receive the exact final resolved prompt',all(r['matches'] for r in transport),transport)
check('actual CLI guard/scorer match shipped helpers',cli['binding']['test_sh_sha256']==manifest['source_sha256']['tests/test.sh'] and cli['binding']['score_py_sha256']==manifest['source_sha256']['tests/tools/score.py'],{k:cli['binding'][k] for k in ['test_sh_sha256','score_py_sha256']})
check('new decomposition map binds final judge',mapping['judge_sha256']==current['judge_sha256'] and mapping['original_count']==37 and float(mapping['total_weight'])==49.5,{'map_sha256':sha(review/'semantics/decomposition-map.json'),'old_rows':mapping['previous_atomic_count'],'new_rows':mapping['atomic_count'],'original_budgets':'Source audit independently compares every original parent to immutable5d0 archive.'})
changed={p:{'before':prior['candidate']['source_sha256'].get(p),'after':h} for p,h in manifest['source_sha256'].items() if prior['candidate']['source_sha256'].get(p)!=h}
check('task delta limited to three reviewed semantic files',set(changed)==set(semantic.values()),changed)
report={
 'scope':'Fresh archive/source/payload/actualCLI schema binding only. No provider, fullOracle, hosted acceptance, full workflow or timing claim.',
 'reviewed_archive':str(args.archive),'reviewed_archive_sha256':archive_hash,'manifest':str(args.manifest),'manifest_sha256':sha(args.manifest),
 'semantic_hashes':{k:current[k+'_sha256'] for k in semantic},'changed_files':changed,'unchanged_files':{p:h for p,h in manifest['source_sha256'].items() if p not in changed},
 'checks':checks,'passed':all(c['passed'] for c in checks),
 'limits':['The final enlarged inventory has fresh local CLI fixtures, not inherited old-row model verdicts.','The existing pinned runtime supplies installed tools with final inputs mounted separately; no updated private image contents claimed.','The unchanged 9000-second Functional budget is 150 minutes; nesting and argv launch do not prove full model/browser completion.','Incomplete evaluations remain ungraded; no checkpoint or partial missing credit is introduced.'],
}
(review/'harness/final_review_binding.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'archive':archive_hash,'functional_rows':current['rows']}))
assert report['passed'],[c for c in checks if not c['passed']]

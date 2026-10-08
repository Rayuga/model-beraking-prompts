"""Record exact provisional candidate provenance, without QC clearance."""
from pathlib import Path
import hashlib, json, subprocess, zipfile

OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[3]
TASK=ROOT/'projects/hireops-recruiting-operations/hireops-recruiting-operations'
PACKAGE=ROOT/'deliverables/hireops-recruiting-operations/2026-10-02-permission-repair'
R3=ROOT/'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
sha=lambda data:hashlib.sha256(data).hexdigest()
read=lambda path:json.loads(path.read_text(encoding='utf-8'))
repair=read(OUT/'repair.json'); validation=read(OUT/'validation.json'); candidate=read(PACKAGE/'candidate_manifest.json')
current={p.relative_to(TASK).as_posix():sha(p.read_bytes()) for p in TASK.rglob('*') if p.is_file()}
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
committed={p:sha(subprocess.check_output(['git','show',f'{commit}:{TASK.relative_to(ROOT).as_posix()}/{p}'],cwd=ROOT)) for p in current}
archive=PACKAGE/candidate['archive']
with zipfile.ZipFile(archive) as z:
    prefix=TASK.name+'/'
    members=[i for i in z.infolist() if not i.is_dir()]
    archived={i.filename[len(prefix):]:sha(z.read(i)) for i in members}
    archive_checks={'crc':z.testzip() is None,'one_root':all(i.filename.startswith(prefix) for i in members),
                    'no_duplicate_members':len(archived)==len(members),'source_matches':archived==current,
                    'shell_modes':all((i.external_attr>>16)&0o111 for i in members if i.filename.endswith('.sh'))}
old_manifest=read(R3/'manifest.json'); old_summary=read(R3/'summary.json')
original_reports={rid:sha((R3/('per-row-review/deterministic.json' if rid=='deterministic-reviewer' else f'per-row-review/rows/{int(rid.rsplit("-",1)[1]):02}.json')).read_bytes()) for rid in old_summary['report_sha256']}
focus=read(OUT/'focused-confirmation.json')
parser=read(OUT/'local-attempt1/configured-inspection/results.json')
parser_bindings={f'tests/{p}':h for p,h in parser['tests_sha256'].items()}
checks={**archive_checks,
    'live_equals_packaged_equals_tested':current==candidate['source_sha256']==validation['source_sha256']==repair['source_sha256'],
    'committed_bytes_match':committed==current,
    'archive_hash_matches':sha(archive.read_bytes())==candidate['sha256'],
    'archive_bytes_match':archive.stat().st_size==candidate['bytes'],
    'file_count':len(current)==len(members)==37,
    'source_clean':not subprocess.check_output(['git','status','--porcelain','--',str(TASK)],cwd=ROOT,text=True).strip(),
    'golden_preserved':all(current[p]==h for p,h in old_manifest['inputs']['task'].items() if p.startswith('solution/')),
    'only_two_task_paths_changed':set(p for p in current if current[p]!=old_manifest['inputs']['task'][p])==set(repair['changed_paths']),
    'focused_confirmation_matches':focus['all_current_task_file_sha256']==current and not focus['focused_defect_remaining'],
    'validation_artifact_hashes':all(sha((ROOT/p).read_bytes())==h for p,h in validation['artifacts'].items()),
    'new_parser_source_bindings':all(current[p]==h for p,h in parser_bindings.items()),
    'original_review_reports_immutable':original_reports==old_summary['report_sha256'],
    'policy_engine_unchanged':all(sha((ROOT/p).read_bytes())==h for p,h in old_manifest['engine_inputs'].items()),
    'rules_template_unchanged':all(sha((ROOT/p).read_bytes())==h for p,h in old_manifest['inputs']['rules'].items())}
result={'status':'PROVISIONAL; COMPLETE CURRENT QC UNAVAILABLE','commit':commit,
        'source_inventory_sha256':sha(json.dumps(current,sort_keys=True,separators=(',',':')).encode()),
        'archive':archive.relative_to(ROOT).as_posix(),'archive_sha256':candidate['sha256'],'archive_bytes':candidate['bytes'],
        'files':len(current),'dimensions':candidate['dimensions'],'checks':checks,'integrity_passed':all(checks.values()),
        'source_sha256':current,'image_id':validation['image_id'],
        'review_status':{'last_round':'R3','pipeline_status':'INCOMPLETE','valid_reports':53,'expected_reports':54,
                        'completed_quality_rows':52,'missing_quality_rows':[46],'deterministic_rows_reviewed':48,
                        'post_repair_full_round_started':False,'current_candidate_cleared':False},
        'evidence':{p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in [OUT/'repair.json',OUT/'validation.json',OUT/'focused-confirmation.json',OUT/'preflight.json',PACKAGE/'candidate_manifest.json',R3/'summary.json',R3/'row46-execution-block.json']},
        'configured_judge_grade_measured':False,'oracle_measured':False,'luna_measured':False,'portal_pass_claimed':False}
(OUT/'artifact-binding.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
assert result['integrity_passed'],checks
print(json.dumps({k:v for k,v in result.items() if k not in ['source_sha256','evidence']},indent=2))

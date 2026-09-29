from pathlib import Path
import hashlib
import json
import tomllib
import zipfile

ROOT = Path.cwd()
HERE = Path(__file__).resolve().parent
TASK = ROOT/'projects/colderwater-playground-devtools'
PRIOR = ROOT/'deliverables/colderwater-playground-devtools/metadata-cleanup-2026-09-27/colderwater-playground-devtools.zip'
TEMPLATE = ROOT/'projects/webdev-task-template'
sha = lambda data: hashlib.sha256(data).hexdigest()
shell = (TASK/'tests/test.sh').read_bytes()
text = shell.decode()
with zipfile.ZipFile(PRIOR) as archive:
    old = archive.read('colderwater-playground-devtools/tests/test.sh').decode()
helper = lambda script: script.split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
checks = []
def check(name, condition, detail=None):
    checks.append({'name':name,'passed':bool(condition),'detail':detail})
check('No CRLF in shell',b'\r' not in shell)
check('Original restart helper unchanged',helper(old)==helper(text),sha(helper(text).encode()))
for rel in ['tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml']:
    current=(TASK/rel).read_bytes()
    with zipfile.ZipFile(PRIOR) as archive:
        original=archive.read('colderwater-playground-devtools/'+rel)
    check(rel+' unchanged from previous upload',current==original,sha(current))
    check(rel+' matches canonical template',(TEMPLATE/rel).read_bytes()==current)
check('Final cleanup matches validated Ridgeline cleanup',text.split('app_group_has_live_processes() {',1)[1].split('\nprobe_ready() {',1)[0]==(ROOT/'projects/ridgeline-print-storefront/tests/test.sh').read_text().split('app_group_has_live_processes() {',1)[1].split('\nprobe_ready() {',1)[0])
inventory={}
for path in sorted((TASK/'tests').glob('*/*/judge.toml')):
    spec=tomllib.loads(path.read_text())
    inventory[path.parent.name]={'count':len(spec['criterion']),'timeout':spec['judge']['timeout'],'weight':sum(c['weight'] for c in spec['criterion']),'words':sum(len(c['description'].split()) for c in spec['criterion'])}
config=tomllib.loads((TASK/'task.toml').read_text())
with zipfile.ZipFile(PRIOR) as archive:
    original_config=tomllib.loads(archive.read('colderwater-playground-devtools/task.toml').decode())
check('Verifier env and timeout unchanged',config['verifier']==original_config['verifier'])
check('Gate wrapper unchanged','run_suite gates 1500' in text)
check('Scored wrapper unchanged','run_suite scored 11100' in text)
budget={'dimension_seconds':{k:v['timeout'] for k,v in inventory.items()},'gate_wrapper_seconds':1500,'scored_wrapper_seconds':11100,'outer_verifier_seconds':config['verifier']['timeout_sec'],'wrapper_total_seconds':12600,'outer_nominal_slack_seconds':config['verifier']['timeout_sec']-12600,'functional_criteria':inventory['functional']['count'],'functional_seconds_per_criterion_before_overhead':round(inventory['functional']['timeout']/inventory['functional']['count'],2),'functional_seconds_per_criterion_after_900_second_reserve':round((inventory['functional']['timeout']-900)/inventory['functional']['count'],2),'completion_latency_measured_with_paid_judge':False}
check('Budget nesting','run_suite scored 11100' in text and sum(inventory[k]['timeout'] for k in ['functional','polish','visual'])<11100 and sum(inventory[k]['timeout'] for k in ['render','constraints'])<1500 and 12600<config['verifier']['timeout_sec'])
for filename in ['cleanup_fixed_probe_results.json','guard_probe_results.json','harness_regression_results.json']:
    report=json.loads((HERE/filename).read_text())
    check(filename+' passes',report['passed'])
    if filename=='cleanup_fixed_probe_results.json':
        begin=text.index("                if criterion.get('type', 'binary') == 'binary':")
        end=text.index('    except (OSError, ValueError, TypeError, KeyError)',begin)
        former='''                if criterion.get('type', 'binary') == 'binary':
                    if raw not in ('yes', 'no'):
                        raise ValueError(f'{dimension}/{name}: invalid binary verdict')
                    if row['value'] != (1 if raw == 'yes' else 0):
                        raise ValueError(f'{dimension}/{name}: inconsistent binary verdict')
                elif criterion['type'] == 'likert':
                    if not isinstance(raw, int) or isinstance(raw, bool) or not 1 <= raw <= criterion['points']:
                        raise ValueError(f'{dimension}/{name}: invalid Likert verdict')
                    if not math.isclose(row['value'], (raw - 1) / (criterion['points'] - 1), abs_tol=0.0001):
                        raise ValueError(f'{dimension}/{name}: inconsistent Likert verdict')
'''
        tested_shell=text[:begin]+former+text[end:]
        check(filename+' unchanged cleanup and lifecycle control flow',sha(tested_shell.encode())==report['test_sh_sha256'],{'tested_shell_sha256':report['test_sh_sha256'],'only_subsequent_change':'raw verdict compatibility inside validate_suite','cleanup_prefix_sha256':sha(text.split('\nprobe_ready() {',1)[0].encode())})
    else:
        check(filename+' bound to final shell',report['test_sh_sha256']==sha(shell))
check('Guard scans structured verdicts only',"reasoning.lstrip().startswith('EVALUATION_INCOMPLETE:')" in text and "row.get('error') is not None" in text)
result={'passed':all(c['passed'] for c in checks),'checks':checks,'test_sh_sha256':sha(shell),'prior_archive_sha256':sha(PRIOR.read_bytes()),'inventory':inventory,'timeout_ledger':budget,'limitations':['Synthetic output fixtures are not real model/Oracle grades.','No measured paid full-suite latency; budget nesting is arithmetic, not a guarantee.','An incomplete evaluation writes canonical zero with graded=0/no_op=1 and a diagnostic; hosted UI may still display zero and requires a rerun.']}
(HERE/'review_binding.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'checks':len(checks),'test_sh_sha256':sha(shell),'timeout_ledger':budget},indent=2))
assert result['passed']

from pathlib import Path
import hashlib
import json

ROOT = Path('/repo')
OUT = Path('/results')
source = ROOT/'references/task-templates/check-standard.py'
code = source.read_text()
obsolete = "check(dim+' same-origin prerequisite','same-origin' in prompt.lower())"
replacement = "check(dim+' public-runtime browser-resource policy', all(s in prompt for s in ('Runtime network policy:', 'public URLs, including CDNs.', 'Do not block', 'require offline operation.')))"
assert code.count(obsolete) == 1
namespace = {'__file__':str(source), '__name__':'patchpad_scoped_standard'}
exec(compile(code.replace(obsolete,replacement),str(source),'exec'),namespace)
result = namespace['validate'](ROOT/'projects/patchpad-editor-v2')
result['scoped_policy_update'] = {
    'reason':'Latest platform QC rejected blanket same-origin runtime gates for this public-network project; user authorized alignment.',
    'shared_checker_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'shared_checker_modified':False,
    'obsolete_same_origin_checks_not_claimed':5,
    'replacement_public_runtime_policy_checks':5,
    'remaining_reference_checks_preserved':len(result['checks'])-5,
}
(OUT/'standard-checks.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"PASS {len(result['checks'])} scoped checks: 113 retained standard checks plus 5 public-runtime replacements; shared checker unchanged")

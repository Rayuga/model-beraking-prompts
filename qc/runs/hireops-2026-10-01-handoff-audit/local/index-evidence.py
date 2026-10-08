import hashlib, json
from pathlib import Path

root=Path(__file__).resolve().parents[4]
run=Path(__file__).resolve().parent.parent
manifest=json.loads((run/'manifest.json').read_text())
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
entries=[]
scopes={
 'agent-boundary.json':'Actual agent container has /app containing only .git and .gitkeep, no /tests or /solution, and no installed judge/RewardKit packages in global Node modules.',
 'gate-witness/results.json':'Actual Chromium UI creation and independent Auditor readback: golden and dead-approval variant satisfy basic pending-record prerequisite, while no-op HTTP-success creation does not. No configured gate verdict or score.',
 'coverage-witness/results.json':'Actual golden and two disposable mutations: stale replacement-grant prices despite correct offer values, and forged Auditor revision role. Golden passes all measured comparisons; no configured-judge scores.',
 'input-binding.json':'Exact current ZIP/source/manifest match; actual agent assets and verifier runtime files match source bytes. Dockerfile and .dockerignore are correctly build-only and excluded from the verifier image.',
 'install-lifecycle/results.json':'Actual Linux installer and sanitized unprivileged golden launch from /tests, normal shared MCP restart durability, single-use refusal and closed reinstall. First driver attempt incorrectly demanded a specific refusal message; the recorded EACCES is a safe refusal, and the corrected second attempt passed.',
 'domain/results.json':'77 local HTTP/domain assertions, actual process replacement and durable readback; no browser/LLM score.',
 'ui/results.json':'Scripted Linux Chromium UI observations including exact money, arbitrary IDs, mobile audit, retained-input failure recovery. No subjective judge grade.',
 'mcp/results.json':'Five actual stdio Playwright MCP feasibility observations in the exact Linux image with configured Chromium. The legacy result localVariation field mentions Windows but actual mcpCommand uses /usr/local/bin/chromium; this run is Linux.',
 'witnesses/SUMMARY.json':'Golden and finite deliberately broken implementations distinguished by actual local HTTP observations; no reward scores.',
 'configured-inspection/results.json':'Installed RewardKit 0.1.7 discovery, resolved prompt/schema, configured GLM CLI construction and OS argument-size launch using /usr/bin/true only; CLI version command. No provider execution.',
 'shared-harness/results.json':'Actual unchanged shared test.sh/restart_mcp.py fixtures reproduce false restart success and unbounded final cleanup. Network disabled; failing local CLI stub invokes no provider.',
}
for relative,scope in scopes.items():
 p=run/'local'/relative
 entries.append({'path':p.relative_to(root).as_posix(),'sha256':sha(p),'scope':scope,'matching_source_files':manifest['inputs']['task']})
index={'input_sha256':manifest['input_sha256'],'classification':'Supplementary measured local evidence only. Not runtime clearance, configured grading, Oracle, Luna or hosted QC. Verify raw logs and script hashes.', 'entries':entries,
 'artifacts':{p.relative_to(root).as_posix():sha(p) for p in (run/'local').rglob('*') if p.is_file() and p.suffix not in {'.sqlite','.db','.shm','.wal'} and p.name!='index-evidence.py'},
 'test_drivers':{str(p):sha(root/p) for p in map(Path,['scripts/check_hireops_domain.cjs','scripts/check_hireops_ui.cjs','scripts/check_hireops_mcp.cjs','scripts/check_hireops_witnesses.cjs'])}}
(run/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print('Indexed',len(entries),'observations;',len(index['artifacts']),'local artifacts')

from pathlib import Path
import hashlib,json,re
root=Path.cwd();sol=root/'projects/colderwater-playground-devtools/solution';out=root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
before=json.loads((out/'solution-before.json').read_text())
after={str(p.relative_to(sol)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest()for p in sol.rglob('*')if p.is_file()}
for p in ['app/server.js','app/src/runtime.ts','app/src/app.tsx','app/package.json','app/package-lock.json','solve.sh']:assert before[p]==after[p],p
oldjs=before['app/public/assets/index-DlddEka4.js'];newjs=next((k,v)for k,v in after.items()if k.startswith('app/public/assets/')and k.endswith('.js'));assert newjs[1]==oldjs
delta=[{'path':k,'before':before.get(k),'after':after.get(k)}for k in sorted(set(before)|set(after))if before.get(k)!=after.get(k)]
(out/'solution-final.json').write_text(json.dumps(after,indent=2)+'\n')
(out/'solution-delta.json').write_text(json.dumps(delta,indent=2)+'\n')
report={'executable_js_unchanged':True,'server_runtime_editor_lockfile_installer_unchanged':True,'new_js':newjs,'css':[(k,v)for k,v in after.items()if k.startswith('app/public/assets/')and k.endswith('.css')],'source_css':after['app/src/style.css'],'public_index':after['app/public/index.html'],'presentation_passed':json.loads((out/'presentation-final/presentation-results.json').read_text())['passed'],'actual_mcp_passed':json.loads((out/'actual-mcp-results.json').read_text())['passed'],'large_controls_passed':json.loads((out/'large-controls-mcp-results.json').read_text())['passed']}
(out/'golden-freeze.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

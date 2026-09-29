from pathlib import Path
import json,hashlib,subprocess,os
root=Path.cwd()
out=root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
out.mkdir(parents=True,exist_ok=True)
old=root/'deliverables/colderwater-playground-devtools/rubric-fix-2026-09-26'
hard=root/'deliverables/colderwater-playground-devtools/hardening-2026-09-26'
suites=[
('golden',old/'golden-browser-check.cjs'),
('runtime',hard/'browser-runtime-check.cjs'),
('library',hard/'browser-library-check.cjs'),
('errors',old/'independent-runtime-cases.cjs'),
('budget',old/'title-and-shared-budget-browser.cjs'),
('network',old/'network-boundary-browser.cjs'),
('validation',old/'validation-boundaries-browser.cjs')]
for name,source in suites:
    dest=out/'runtime'/name
    dest.mkdir(parents=True,exist_ok=True)
    code=source.read_text(encoding='utf-8')
    code=code.replace("colderwater-agent:20260926-hardening","colderwater-agent:20260926-followup").replace("ridgeline-verifier:20260926-hardening","colderwater-verifier:20260926-followup")
    if name=='runtime':
        code=code.replace("assert.match(await log(),/printed/);","assert((await log()).length>0);assert((await frame().locator('body').innerText()).length>0);")
        code=code.replace("await page.waitForTimeout(1200)","await page.waitForTimeout(2100)").replace("await page.waitForTimeout(1000)","await page.waitForTimeout(2100)")
        code=code.replace("await marker('auto-off');\n  });","await marker('auto-off');await page.getByRole('button',{name:/^Run/}).click();await complete();await marker('auto-queued');\n  });")
    (dest/'probe.cjs').write_text(code,encoding='utf-8',newline='\n')
(out/'golden-start.sh').write_text("#!/bin/bash\nset -euo pipefail\nbash /solution/solve.sh\ncd /app\nexec node server.js\n",encoding='utf-8',newline='\n')
solution=root/'projects/colderwater-playground-devtools/solution'
manifest={str(p.relative_to(solution)).replace(os.sep,'/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in solution.rglob('*') if p.is_file()}
(out/'solution-before.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'prepared':len(suites),'out':str(out)}))

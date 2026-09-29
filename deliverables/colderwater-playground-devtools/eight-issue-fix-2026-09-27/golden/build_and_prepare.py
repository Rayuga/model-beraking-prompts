from pathlib import Path
import hashlib, json, shutil, subprocess

out = Path(__file__).resolve().parent
root = out.parents[3]
app = root / 'projects/colderwater-playground-devtools/solution/app'
tools = root / 'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules'
hashfile = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
snapshot = lambda directory: {p.relative_to(directory).as_posix(): hashfile(p) for p in directory.rglob('*') if p.is_file()}
before = snapshot(app)
versions = {name: json.loads((tools / name / 'package.json').read_text())['version'] for name in ['vite', 'typescript', 'esbuild', 'rollup']}
assert versions['vite'] == '7.1.7' and versions['typescript'] == '5.9.2'
stage = out / 'build-staging'
assert not stage.exists()
shutil.copytree(app, stage)
command = ['node', str(tools / 'vite/bin/vite.js'), 'build']
result = subprocess.run(command, cwd=stage, text=True, capture_output=True)
(out / 'build.log').write_text(result.stdout + result.stderr, encoding='utf-8')
assert result.returncode == 0, result.stderr
assert stage.resolve().is_relative_to(out.resolve())
public = app / 'public'
assert public.resolve() == (root / 'projects/colderwater-playground-devtools/solution/app/public').resolve()
for item in public.iterdir():
    if item.is_dir(): shutil.rmtree(item)
    else: item.unlink()
shutil.copytree(stage / 'public', public, dirs_exist_ok=True)
after = snapshot(app)
assert all(after[p] == before[p] for p in before if not p.startswith('public/'))
assert 'Local library' in next((public / 'assets').glob('*.js')).read_text(encoding='utf-8')
assert 'Local & offline' not in next((public / 'assets').glob('*.js')).read_text(encoding='utf-8')
report = {'network_access': False, 'packages_installed': False, 'build_toolchain': 'existing pinned local Windows tools', 'versions': versions, 'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'command': command, 'before': before, 'after': after, 'changed_build_outputs': [p for p in set(before) | set(after) if before.get(p) != after.get(p)], 'runtime_unchanged': before['src/runtime.ts'] == after['src/runtime.ts'], 'server_unchanged': before['server.js'] == after['server.js']}
(out / 'build_binding.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
previous = out.parents[1] / 'interaction-keyboard-fix-2026-09-27'
code = (previous / 'keyboard-proof.cjs').read_text(encoding='utf-8')
code = code.replace("const { chromium }", "const undocumented = process.env.CW_UNDOCUMENTED_ESCAPE === '1';\nconst prefix = undocumented ? 'undocumented-' : '';\nconst { chromium }")
code = code.replace("await check('documented_escape_and_served_build'", "await check('native_escape_optional_hint_and_served_build'")
code = code.replace("assert.match(await page.locator('#keyboard-help').innerText(),/Escape, then Tab Leave editor/);", "if (undocumented) { await page.locator('#keyboard-help').evaluate(e => e.textContent = e.textContent.replace('Escape, then Tab Leave editor · ', '')); assert.doesNotMatch(await page.locator('#keyboard-help').innerText(), /Escape/); } else assert.match(await page.locator('#keyboard-help').innerText(),/Escape, then Tab Leave editor/);\n    assert.match(await page.locator('.offline').innerText(), /Local library/);\n    assert.doesNotMatch(await page.locator('.offline').innerText(), /offline/i);")
code = code.replace("assert.match(info.text,/Escape, then Tab Leave editor/);", "if (undocumented) assert.doesNotMatch(info.text,/Escape/); else assert.match(info.text,/Escape, then Tab Leave editor/);")
code = code.replace("'/work/keyboard-", "'/work/'+prefix+'keyboard-")
code = code.replace('`/work/keyboard-help-', '`/work/${prefix}keyboard-help-')
code = code.replace("report.passed=true;", "report.undocumentedEscapeVariant=undocumented;report.variantScope=undocumented?'Only visible hint text removed from this temporary browser DOM before actual keyboard route; application handlers unchanged':'Shipped golden';report.passed=true;")
(out / 'keyboard-proof.cjs').write_text(code, encoding='utf-8')
(out / 'keyboard-start.sh').write_text('#!/bin/bash\nset -euo pipefail\ncp -a /solution/app/. /app/\ncd /app\nnode server.js > /work/keyboard-server.log 2>&1 &\nserver_pid=$!\ntrap \'kill "$server_pid" 2>/dev/null || true\' EXIT\nfor step in $(seq 1 100); do if curl -sf http://localhost:3000/api/health > /dev/null; then break; fi; sleep .1; done\nnode /work/keyboard-proof.cjs\n', encoding='utf-8', newline='\n')
print(json.dumps({'versions': versions, 'changed_build_outputs': report['changed_build_outputs'], 'runtime_unchanged': report['runtime_unchanged']}, indent=2))

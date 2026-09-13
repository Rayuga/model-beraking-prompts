from pathlib import Path

exec((Path(__file__).parent / 'migrate.py').read_text().split('old_cfg =', 1)[0])
old = out.parent / '2.0.0'
browser = get(old / 'browser-regression.cjs').replace('WrongPassword!2026', 'CommonGround!wrong')
browser = browser.replace("  await vote(leila, courtyard.title, ['Extend to 9 pm']);", """  for (const ids of [[], courtyard.choices.map(c => c.id)]) {
    await rejected(leila, ruth, captured.route, 'POST', {...captured.body, choice_ids: ids, operation_id: op()}, 400);
  }
  await rejected(owen, ruth, `/api/ballots/${room.id}/vote`, 'POST', {...voteBase, choice_ids:[room.choices[0].id], operation_id:op()}, 403);
  pass('empty/multiple single-choice and ineligible-member refusals leave full state unchanged');
  await vote(leila, courtyard.title, ['Extend to 9 pm']);""")
browser = browser.replace("  assert(!JSON.stringify(audit).includes('choice-courtyard'));", """  assert(!JSON.stringify(audit).includes('choice-courtyard'));
  for (const event of audit) assert(Number.isFinite(Date.parse(event.created_at)));
  const sql = execFileSync('python3', ['-c', `import sqlite3,json; db=sqlite3.connect('file:/app/commonground.db?mode=ro',uri=True); print(json.dumps({'ballots':db.execute('SELECT id,status,revision FROM ballots ORDER BY id').fetchall(),'tables':[r[0] for r in db.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")]}))`], {encoding:'utf8'});
  const stored = JSON.parse(sql);
  assert.deepEqual(stored.ballots, (await ballots(ruth)).map(b=>[b.id,b.status,b.revision]).sort((a,b)=>a[0].localeCompare(b[0])));
  for (const table of ['sessions','memberships','anonymous_votes','participation','operation_receipts','audit']) assert(stored.tables.includes(table));
  pass('real SQLite schema and accepted ballots match protected responses; audit times are readable');""")
browser = browser.replace("  await ruth.screenshot({path:'/results/desktop.png',fullPage:true});", """  await ruth.screenshot({path:'/results/desktop.png',fullPage:true});
  await ruth.getByRole('button',{name:'Switch to dark theme'}).click();
  await ruth.screenshot({path:'/results/desktop-dark.png',fullPage:true});
  await ruth.getByRole('button',{name:'Switch to light theme'}).click();""")
edit(out / 'browser-regression.cjs', browser)
driver = get(old / 'run-local.py')
driver = driver.replace('dict(render=2, constraints=2, functional=19, polish=5)', 'dict(render=2, constraints=2, functional=19, polish=4, visual=6)')
driver = driver.replace('all 28 criteria', 'all 33 criteria')
start = driver.index("    config=tomllib.loads(Path('/root/.codex/config.toml').read_text())")
end = driver.index("    print(json.dumps(results))", start)
driver = driver[:start] + '''    config=tomllib.loads(Path('/root/.codex/config.toml').read_text())
    assert config['model_reasoning_effort']=='max' and 'model_provider' not in config
    version=subprocess.check_output(['codex','--version'],text=True).strip()
    assert '0.151.0' in version,version
    results.append(dict(name='Central max effort and pinned Codex load without a provider override',passed=True))
    OUT.joinpath('runtime-results.json').write_text(json.dumps(dict(results=results,dimensions=dimensions,dependencies=deps,codex=version),indent=2)+'\\n')
''' + driver[end:]
driver = driver.replace('functional=1,polish=1)', 'functional=1,polish=1,visual=1)')
driver = driver.replace('functional=.25,polish=.75),.45', 'functional=.25,polish=.75,visual=.5),.4')
driver = driver.replace("('partial render gate',dict(render=.5,constraints=1,functional=1,polish=1,visual=1),0)", "('partial positive render gate',dict(render=.5,constraints=1,functional=1,polish=1,visual=1),1)")
driver = driver.replace("        ('missing dimension'", "        ('zero functional floor',dict(render=1,constraints=1,functional=0,polish=1,visual=1),.4),\n        ('nan dimension',dict(render=1,constraints=1,functional=float('nan'),polish=1,visual=1),0),\n        ('out of range',dict(render=1,constraints=1,functional=2,polish=1,visual=1),0),\n        ('missing dimension'")
driver = driver.replace("        results.append(dict(name=name,passed=True,reward=actual))", """        dims=json.loads(Path('/logs/verifier/reward.json').read_text())
        assert set(['render','constraints','functional','polish','visual']) <= dims.keys()
        ctrf=json.loads(Path('/logs/verifier/ctrf.json').read_text())
        assert ctrf['summary']['total'] in [0,5]
        results.append(dict(name=name,passed=True,reward=actual))""")
driver = driver.replace("    OUT.joinpath('harness-results.json')", "    shutil.copyfile('/logs/verifier/prompt-provenance.json', OUT/'prompt-provenance.json')\n    OUT.joinpath('harness-results.json')")
edit(out / 'run-local.py', driver)
edit(out / 'agent-preflight.cjs', get(old / 'agent-preflight.cjs'))

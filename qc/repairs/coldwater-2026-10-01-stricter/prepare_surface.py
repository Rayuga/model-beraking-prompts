from pathlib import Path
p=Path(__file__).parent/'drivers/surface_flow.cjs';s=p.read_text()
s=s.replace('await d.open();await d.completed();','await d.open();')
s=s.replace("theme:p.getByRole('button',{name:/theme/i}),examples:p.locator('select'),", "history:p.getByRole('button',{name:'Revision 1',exact:true}),restore:p.getByRole('button',{name:'Restore selected revision',exact:true}),")
s=s.replace("  const names={};", "  await controls.history.click();\n  const names={};")
a=s.index('  await reach(controls.examples)');b=s.index('  for(let n=0;',a)
s=s[:a]+'''  await reach(controls.saved);await p.keyboard.press('Enter');assert.equal(await d.source(),keyboardRecord.code);
  await reach(controls.history);await p.keyboard.press('Enter');assert.equal(await p.getByLabel('Historical source').innerText(),keyboardRecord.code);await reach(d.editor());
  report.checks.cw_keyboard_library_navigation={pass:true,saved_source:await d.source(),historical_source:await p.getByLabel('Historical source').innerText(),pointer_used_in_route:false};
'''+s[b:]
a=s.index("  await p.screenshot({path:path.join(out,'desktop-theme-one.png')");b=s.index('  await p.setViewportSize',a)
s=s[:a]+"  await p.screenshot({path:path.join(out,'desktop.png'),fullPage:true});\n"+s[b:]
s=s.replace("['desktop-theme-one.png','desktop-theme-two.png','mobile.png']", "['desktop.png','mobile.png']")
s=s.replace("  report.runtime_edges=await require('./runtime_edge_flow.cjs').runEdges(d,l);",'')
p.write_text(s)

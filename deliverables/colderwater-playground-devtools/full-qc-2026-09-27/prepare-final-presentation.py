from pathlib import Path
out=Path.cwd()/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
source=(out/'runtime/supplement/probe.cjs').read_text()
start=source.index(" await check('initial_examples'")
end=source.index(" await check('cw_theme_switch_legibility'")
source=source[:start]+source[end:]
source=source.replace("const other=await palette();for(const key","const other=await palette();const dirtyColor=await page.locator('.paneheading .dirty').first().evaluate(e=>getComputedStyle(e).color);assert.equal(dirtyColor,'rgb(134, 88, 8)');for(const key")
source=source.replace("supplement-results.json","presentation-results.json")
folder=out/'presentation-final';folder.mkdir(exist_ok=True)
(folder/'probe.cjs').write_text(source,encoding='utf-8',newline='\n')
print(folder)

from pathlib import Path
out=Path(__file__).resolve().parent
driver=(out/'actual-mcp-proof.py').read_text()
driver=driver.replace("actual-mcp-stderr.log","large-controls-mcp-stderr.log").replace("actual-mcp-probe.js","large-controls-mcp-probe.js").replace("actual-mcp-results.json","large-controls-mcp-results.json")
(out/'large-controls-mcp-proof.py').write_text(driver,encoding='utf-8',newline='\n')

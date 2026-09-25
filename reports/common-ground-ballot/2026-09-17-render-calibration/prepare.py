from pathlib import Path

HERE=Path(__file__).resolve().parent
previous=HERE.parent/'2026-09-17-r27-fresh-runs'
container=(previous/'diagnose-container.py').read_text(encoding='utf-8')
container=container.replace("subprocess.run(['chown'", "subprocess.run([sys.executable,'/analysis/patch-copy.py'],check=True)\nsubprocess.run(['chown'",1)
(HERE/'diagnose-container.py').write_text(container,encoding='utf-8',newline='\n')
driver=(previous/'run-diagnostics.py').read_text(encoding='utf-8')
driver=driver.replace("with ThreadPoolExecutor(max_workers=2) as pool: rows=list(pool.map(run,subjects))", "rows=[run('gpt')]")
(HERE/'run-diagnostics.py').write_text(driver,encoding='utf-8',newline='\n')
support=(previous/'diagnose.cjs').read_text(encoding='utf-8').split('async function main(){')[0]
(HERE/'diagnose.cjs').write_text(support+(HERE/'render-body.js').read_text(encoding='utf-8'),encoding='utf-8',newline='\n')

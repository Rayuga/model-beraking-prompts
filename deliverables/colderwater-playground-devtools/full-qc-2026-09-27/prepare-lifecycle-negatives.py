from pathlib import Path
import shutil,json,subprocess,time
root=Path.cwd();out=root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
old=root/'deliverables/colderwater-playground-devtools/rubric-fix-2026-09-26'
hard=root/'deliverables/colderwater-playground-devtools/hardening-2026-09-26'
install=out/'installer';install.mkdir(exist_ok=True);shutil.copyfile(old/'oracle-reinstall-check.cjs',install/'probe.cjs')
mock=out/'negative-gates';mock.mkdir(exist_ok=True)
for name in ['server.cjs','index.html','browser-proof.cjs']:shutil.copyfile(old/'mock-fixture'/name,mock/name)
restart=out/'restart';restart.mkdir(exist_ok=True)
shutil.copyfile(hard/'browser-restart-check.cjs',restart/'browser-restart-check.cjs')
stub=(hard/'harness_rewardkit_stub.py').read_text()
start=stub.index("        body = {'title'");end=stub.index("    else:\n        request('/write'",start)
stub=stub[:start]+"        subprocess.run(['node','/local-evidence/browser-restart-check.cjs','prepare'], check=True, timeout=100)\n"+stub[end:]
start=stub.index("        after = request('/api/snippets/'");end=stub.index("    else:\n        after = request('/fixture'",start)
stub=stub[:start]+"        subprocess.run(['node','/local-evidence/browser-restart-check.cjs','verify'], check=True, timeout=100)\n        events.append({'browser_restart_criterion': 'passed'})\n"+stub[end:]
stub=stub.replace("        {'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'restart_app','arguments':{}}},\n",'')
stub=stub.replace("    assert replies[3]['result']['isError'] is True, replies\n",'')
(restart/'harness_rewardkit_stub.py').write_text(stub,encoding='utf-8',newline='\n')
boot=(hard/'harness_boot.sh').read_text()
boot=boot.replace("assert result['reward']==","print((root/'scored/rewardkit.log').read_text() if (root/'scored/rewardkit.log').exists() else 'No scored log')\nassert result['reward']==")
(restart/'harness_boot.sh').write_text(boot,encoding='utf-8',newline='\n')
print('prepared installer, current real-restart harness, and two negative gate fixtures')

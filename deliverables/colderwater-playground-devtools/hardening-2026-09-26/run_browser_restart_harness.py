from pathlib import Path
import subprocess

root = Path.cwd()
out = Path(__file__).resolve().parent
stub = (out / 'harness_rewardkit_stub.py').read_text(encoding='utf-8')
start = stub.index("        body = {'title'")
end = stub.index('    else:\n        request(\'/write\'', start)
stub = stub[:start] + "        subprocess.run(['node','/local-evidence/browser-restart-check.cjs','prepare'], check=True, timeout=100)\n" + stub[end:]
start = stub.index("        after = request('/api/snippets/'")
end = stub.index('    else:\n        after = request(\'/fixture\'', start)
stub = stub[:start] + "        subprocess.run(['node','/local-evidence/browser-restart-check.cjs','verify'], check=True, timeout=100)\n        events.append({'browser_restart_criterion': 'passed'})\n" + stub[end:]
(out / 'harness_browser_stub.py').write_text(stub, encoding='utf-8', newline='\n')
boot = (out / 'harness_boot.sh').read_text(encoding='utf-8').replace('harness_rewardkit_stub.py', 'harness_browser_stub.py')
boot = boot.replace("assert result['reward']==", "print((root/'scored/rewardkit.log').read_text() if (root/'scored/rewardkit.log').exists() else 'No scored log')\nassert result['reward']==")
(out / 'harness_browser_boot.sh').write_text(boot, encoding='utf-8', newline='\n')
command = ['docker', 'run', '--rm', '--network', 'none',
           '--mount', f'type=bind,source={root / "projects/colderwater-playground-devtools"},target=/source-task,readonly',
           '--mount', f'type=bind,source={out},target=/local-evidence,readonly',
           '-e', 'HARNESS_CASE=golden', '-e', 'HARNESS_SECRET=must-not-reach-app',
           '-e', 'REWARDKIT_JUDGE=local-harness-stub', '-e', 'REWARDKIT_MODEL=not-a-real-model',
           'colderwater-verifier:20260926-hardening', 'bash', '/local-evidence/harness_browser_boot.sh']
result = subprocess.run(command, text=True, capture_output=True, timeout=280, encoding='utf-8')
(out / 'browser_restart_harness.log').write_text(result.stdout + result.stderr, encoding='utf-8')
print(result.stdout)
print(result.stderr)
assert result.returncode == 0, result.returncode

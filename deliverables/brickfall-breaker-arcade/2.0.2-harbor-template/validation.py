"""Unpaid regression using explicitly provisioned LOCAL tools, not Harbor validation."""
import subprocess

subprocess.run(['python3', '/reference/local-checks.py'], check=True)
print('PASS current app/runner regression in historical local tool image; '
      'NOT validation of the new Dockerfile or Harbor tool injection', flush=True)

"""Unpaid current-source regressions. See local image provenance in the README."""
import subprocess
subprocess.run(['python3','/hardening/validate-release.py'],check=True)
subprocess.run(['python3','/targeted/targeted.py'],check=True)
print('PASS current-source regression; no paid model invoked',flush=True)

subprocess.run(['python3','/results/alignment.py'],check=True)

subprocess.run(['python3','/results/reward-regression.py'],check=True)

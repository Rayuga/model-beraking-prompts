"""Disposable offline container only. No provider keys or model invocation."""
import subprocess
import sys
subprocess.run(['bash', '/solution/solve.sh'], check=True)
subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
subprocess.run(['bash', '/tests/app-lifecycle.sh', 'start'], check=True)
try:
    subprocess.run(['node', '/results/' + (sys.argv[1] if len(sys.argv) > 1 else 'additional-regression.cjs')], check=True, timeout=420)
finally:
    subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)

"""Start the golden preview in a fresh disposable container; no judge calls."""
import os,subprocess
from pathlib import Path
if not Path('/app/package.json').exists():
    subprocess.run(['bash','/solution/solve.sh'],check=True)
os.chdir('/app')
os.execvp('npm',['npm','start'])

"""Serve a copied golden app; preserve this preview's SQLite data on restart."""
from pathlib import Path
import os, subprocess
if not Path('/app/package.json').exists():
    subprocess.run(['bash','/solution/solve.sh'],check=True)
os.chdir('/app')
os.execvp('npm',['npm','start'])

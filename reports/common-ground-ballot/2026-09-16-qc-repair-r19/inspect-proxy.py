import os
from pathlib import Path
print('Proxy environment variable names:', [k for k in os.environ if 'proxy' in k.lower()])
print('APT files mentioning proxy:', [str(p) for p in Path('/etc/apt/apt.conf.d').glob('*') if 'proxy' in p.read_text().lower()])

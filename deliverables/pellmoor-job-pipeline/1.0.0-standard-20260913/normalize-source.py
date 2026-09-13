from pathlib import Path
import re
root=Path(__file__).resolve().parents[3]
task=root/'projects/pellmoor-job-pipeline'
rules=task/'solution/backend/rules.js'
text=rules.read_text(encoding='utf-8')
text=re.sub(r'/\*.*?\*/', '', text, flags=re.S)
text=re.sub(r'\s*//[^\n]*', '', text)
rules.write_text(text,encoding='utf-8',newline='\n')
for p in task.rglob('*'):
    if p.is_file():
        data=p.read_bytes()
        p.write_bytes(data.replace(b'\r\n',b'\n'))
print('Removed authored rules comments; normalized task text to LF')

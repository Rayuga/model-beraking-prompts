from pathlib import Path
import shutil

p = Path(__file__).resolve().parent
f = p / 'gpt-replay.cjs'
s = f.read_text(encoding='utf-8')
s = s.replace(chr(7) + 'wait h.ruth', '`await h.ruth')
s = s.replace("checkboxes:await h.ruth.locator('#view-panel input[type=checkbox]').count()};);", "checkboxes:await h.ruth.locator('#view-panel input[type=checkbox]').count()};`);")
f.write_text(s, encoding='utf-8', newline='\n')
if not (p/'iteration-02-rounds').exists():
    shutil.copytree(p/'rounds', p/'iteration-02-rounds')
head = (p/'review.cjs').read_text(encoding='utf-8').split('const reviewSupport =')[0]
(p/'rounds.cjs').write_text(head + (p/'rounds-body.txt').read_text(encoding='utf-8'), encoding='utf-8', newline='\n')

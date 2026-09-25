import re, sys
from pathlib import Path
chunks=re.findall(r"<<'PY'\n(.*?)\nPY",Path('/tests/test.sh').read_text(),re.S)
assert len(chunks)==5
sys.argv=['provenance','/evidence/final-prompt-provenance.json']
exec(compile(chunks[0],'actual runner provenance','exec'),{})
exec(compile(chunks[1],'actual RewardKit discovery','exec'),{})

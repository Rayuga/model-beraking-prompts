"""Unpaid offline smoke of the exact build-time assertions and OpenRouter routing.

Execute in a disposable local image with the restored versions. A loopback fake
provider checks credential routing only; it never returns a score/model answer.
"""
import http.server
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import tomllib

checks=[]
docker=Path('/tests/Dockerfile').read_text()
for command in re.findall(r'^RUN (command -v codex[\s\S]*?)(?=\nRUN |\nCOPY )|^RUN (node -e [^\n]+)',docker,re.M):
    script=next(x for x in command if x).replace('\\\n',' ')
    subprocess.run(['bash','-ec',script],check=True,timeout=45)
    checks.append('Exact new Dockerfile tool/browser assertion')
assert len(checks)==2,checks
config=tomllib.loads(Path('/root/.codex/config.toml').read_text())
assert config['model_providers']['openrouter']['env_key']=='OPENROUTER_API_KEY'

observed=[]
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
        payload=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        observed.append({'path':self.path,'model':payload.get('model'),'header_matches':self.headers.get('Authorization')=='Bearer local-test-only-not-a-provider-key'})
        self.send_response(401);self.send_header('Content-Type','application/json');self.end_headers()
        self.wfile.write(b'{"error":{"message":"Intentional unpaid loopback authentication probe","type":"invalid_request_error"}}')
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
env=os.environ.copy()
for name in ('OPENAI_API_KEY','CODEX_ACCESS_TOKEN','OPENROUTER_API_KEY'):env.pop(name,None)
env['OPENROUTER_API_KEY']='local-test-only-not-a-provider-key'
# No login/auth.json: test Codex's custom-provider env_key directly. Do not
# persist the temporary config or synthetic credential in shipped task files.
assert not Path('/root/.codex/auth.json').exists(), 'Expected a clean credential-free tool image'
try:
    proc=subprocess.run(['codex','exec','--skip-git-repo-check','-c',f'model_providers.openrouter.base_url="http://127.0.0.1:{server.server_port}/api/v1"','-m','openai/gpt-5.6-luna','Local transport smoke only.'],env=env,capture_output=True,text=True,timeout=30)
    exit_code=proc.returncode
except subprocess.TimeoutExpired:
    exit_code='timeout-after-request' if observed else 'timeout-no-request'
server.shutdown()
assert observed and all(x['header_matches'] and x['model']=='openai/gpt-5.6-luna' and x['path']=='/api/v1/responses' for x in observed),observed
checks.append('OpenRouter-only env_key produces authenticated loopback Responses request without OPENAI alias/login')
result={'passed':checks,'provider':'loopback stub returning intentional 401, no external model','requests':observed,'codex_exit':exit_code,'image':'brickfall-preflight-verifier:2.0.3','exact_new_image':True}
Path('/results/tool-smoke.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))

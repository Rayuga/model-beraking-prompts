"""Unpaid pinned-RewardKit/Codex transport test against loopback only."""
from pathlib import Path
import http.server, json, os, re, subprocess, tempfile, threading, tomllib
import base64, hashlib, ssl, struct, socket

assert socket.gethostbyname('api.openai.com')=='127.0.0.1', 'Run only with the documented loopback --add-host mapping and --network none'

docker = Path('/tests/Dockerfile').read_text()
# Execute the exact shared-template patch in a disposable container, not host.
patch = next(line[4:] for line in docker.splitlines() if line.startswith('RUN python3 -c'))
subprocess.run(['bash','-ec',patch],check=True)
from rewardkit.agents import CodexCLI

observed=[]
class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*args): pass
    def do_GET(self):
        if self.headers.get('Upgrade','').lower()!='websocket':
            self.send_response(404);self.send_header('Content-Length','0');self.end_headers();return
        accept=base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
        self.send_response(101);self.send_header('Upgrade','websocket');self.send_header('Connection','Upgrade');self.send_header('Sec-WebSocket-Accept',accept);self.end_headers();self.wfile.flush()
        self.connection.settimeout(15)
        first=self.rfile.read(2);length=first[1]&127
        if length==126:length=struct.unpack('!H',self.rfile.read(2))[0]
        elif length==127:length=struct.unpack('!Q',self.rfile.read(8))[0]
        mask=self.rfile.read(4) if first[1]&128 else None
        payload=self.rfile.read(length)
        if mask:payload=bytes(x^mask[i%4] for i,x in enumerate(payload))
        packet=json.loads(payload);body=packet.get('response',packet)
        observed.append(dict(path=self.path,model=body.get('model'),reasoning=body.get('reasoning'),transport='native OpenAI websocket',authenticated=self.headers.get('Authorization')=='Bearer local-only-synthetic-key'))
        self.wfile.write(b'\x88\x02\x03\xe8');self.wfile.flush();self.close_connection=True
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        observed.append(dict(path=self.path, model=body.get('model'),reasoning=body.get('reasoning'),authenticated=self.headers.get('Authorization')=='Bearer local-only-synthetic-key'))
        self.send_response(401);self.send_header('Content-Type','application/json');self.end_headers()
        self.wfile.write(b'{"error":{"message":"Intentional offline transport probe","type":"invalid_request_error"}}')
with tempfile.TemporaryDirectory(prefix='patchpad-openai-smoke-') as tmp:
    for key in ('OPENROUTER_API_KEY','CODEX_ACCESS_TOKEN','REWARDKIT_FORCE_OAUTH'):
        os.environ.pop(key,None)
    for key in ('OPENAI_BASE_URL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'):os.environ.pop(key,None)
    cert=str(Path(tmp,'cert.pem'));key=str(Path(tmp,'key.pem'))
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=api.openai.com','-addext','subjectAltName=DNS:api.openai.com','-addext','basicConstraints=critical,CA:FALSE'],check=True,capture_output=True)
    tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);tls.load_cert_chain(cert,key)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',443),Handler)
    server.socket=tls.wrap_socket(server.socket,server_side=True)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    os.environ.update(OPENAI_API_KEY='local-only-synthetic-key',CODEX_HOME=tmp,CODEX_CA_CERTIFICATE=cert,NO_PROXY='api.openai.com,127.0.0.1')
    block=docker.split("&& printf '%s\\n'",1)[1].split('> /root/.codex/config.toml',1)[0]
    config='\n'.join(re.findall(r"'([^']*)'",block))+'\n'
    assert tomllib.loads(config)==dict(model_reasoning_effort='max',approval_policy='never',sandbox_mode='danger-full-access')
    Path(tmp,'config.toml').write_text(config)
    cli=CodexCLI();cli.ensure_installed()
    command=cli.build_command('Transport smoke only.',{'type':'object','properties':{'ok':{'type':'boolean'}},'required':['ok'],'additionalProperties':False})+cli.model_args('gpt-5.6-luna')
    assert '--dangerously-bypass-approvals-and-sandbox' in command
    try:
        proc=subprocess.run(command,capture_output=True,text=True,timeout=35)
        status=proc.returncode
        diagnostic=proc.stderr[-2000:]
    except subprocess.TimeoutExpired as error:
        status='timeout';diagnostic=(error.stderr or b'').decode(errors='replace')[-4000:]
    finally: cli.cleanup()
server.shutdown()
result=dict(requests=observed,exit=status,diagnostic=diagnostic,paid_run=False,scope='Pinned tools, exact Docker config and RewardKit patch, native OpenAI websocket redirected to loopback with a temporary trusted test certificate; network none, no model answer or score')
Path('/results/provider-smoke.json').write_text(json.dumps(result,indent=2)+'\n')
assert observed,diagnostic
assert all(x['path']=='/v1/responses' and x['authenticated'] and x['model']=='gpt-5.6-luna' and x['reasoning']['effort']=='max' for x in observed),observed
print('PASS RewardKit-managed OpenAI login, unprefixed model, max reasoning, noninteractive Codex command; no paid request')

import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
IMAGE = 'sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d'
SCRIPT = r'''
import http.server, json, platform, threading, time, urllib.request
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Length', '8')
        self.end_headers()
        for i in range(8):
            self.wfile.write(b'x'); self.wfile.flush()
            if i != 7: time.sleep(.5)
server=http.server.HTTPServer(('127.0.0.1',0),Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
url='http://127.0.0.1:%s/' % server.server_port
started=time.monotonic()
body=urllib.request.urlopen(url, timeout=2).read()
elapsed=time.monotonic()-started
server.shutdown(); server.server_close()
print(json.dumps({'python':platform.python_version(),'socket_timeout_seconds':2,'elapsed_seconds':elapsed,'bytes':len(body),'body':body.decode(),'exceeded_socket_timeout_with_success':elapsed>3,'limitation':'Exact readiness read expression, bounded synthetic server. Not a full test.sh run or configured judge.'}))
assert elapsed>3 and body==b'xxxxxxxx'
'''

def main():
    command=['docker','run','--rm','--pull','never','--network','none',IMAGE,'python','-c',SCRIPT]
    (HERE/'command.json').write_text(json.dumps(command,indent=2)+'\n',encoding='utf-8')
    start=time.monotonic()
    result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=40)
    (HERE/'stdout.log').write_text(result.stdout,encoding='utf-8')
    (HERE/'stderr.log').write_text(result.stderr,encoding='utf-8')
    row={'exit_code':result.returncode,'wall_seconds':time.monotonic()-start,'image':IMAGE,'paid_provider':False,'network':'none','observation':json.loads(result.stdout) if result.returncode==0 else None}
    (HERE/'RESULTS.json').write_text(json.dumps(row,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(row))
    raise SystemExit(result.returncode)

if __name__=='__main__':main()

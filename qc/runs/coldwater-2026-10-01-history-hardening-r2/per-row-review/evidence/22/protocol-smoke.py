import inspect
import json
import selectors
import subprocess
import time
from pathlib import Path


def rpc_probe(command, navigate=False):
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    def rpc(message):
        process.stdin.write(json.dumps(message) + '\n')
        process.stdin.flush()
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if not selector.select(timeout=1):
                continue
            line = process.stdout.readline()
            if not line:
                raise RuntimeError('MCP exited before reply')
            reply = json.loads(line)
            if reply.get('id') == message['id']:
                print(json.dumps({'command': command, 'request': message, 'reply': reply}))
                if 'error' in reply or reply.get('result', {}).get('isError'):
                    raise RuntimeError('MCP request failed')
                return reply
        raise TimeoutError('MCP reply timeout')
    try:
        rpc({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'row22-audit','version':'1'}}})
        process.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n')
        process.stdin.flush()
        rpc({'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}})
        if navigate:
            rpc({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'browser_navigate','arguments':{'url':'about:blank'}}})
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        selector.close()


rpc_probe(['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'], True)
rpc_probe(['/usr/local/bin/python3','/tests/tools/restart_mcp.py'])
from rewardkit.runner import discover
print('discover_signature', inspect.signature(discover))
print('discover_source', inspect.getsource(discover))

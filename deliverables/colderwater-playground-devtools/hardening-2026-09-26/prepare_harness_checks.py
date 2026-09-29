from pathlib import Path

out = Path(__file__).resolve().parent
prior = out.parents[1] / 'ridgeline-print-storefront/hardening-2026-09-26'
for filename in ('harness_boot.sh', 'relative_server.js'):
    (out / filename).write_bytes((prior / filename).read_bytes())
runner = (prior / 'run_harness_checks.py').read_text(encoding='utf-8').replace('ridgeline-print-storefront', 'colderwater-playground-devtools').replace('ridgeline-verifier:', 'colderwater-verifier:')
(out / 'run_harness_checks.py').write_text(runner, encoding='utf-8')
stub = (prior / 'harness_rewardkit_stub.py').read_text(encoding='utf-8')
stub = stub.replace("assert len(request('/api/prints')['prints']) == 8", "assert isinstance(request('/api/snippets'), list)")
start = stub.index("        body = {'checkout_id'")
end = stub.index('    else:\n        request(\'/write\'', start)
stub = stub[:start] + "        body = {'title':'Harness durable snippet','filename':'durable.js','code':'console.log(42);\\n'}\n        before = request('/api/snippets', body)\n        assert before['revision'] == 1\n" + stub[end:]
start = stub.index("        after = request('/api/orders/'")
end = stub.index('    else:\n        after = request(\'/fixture\'', start)
stub = stub[:start] + "        after = request('/api/snippets/' + str(before['id']))\n        assert after == before\n        assert len(request('/api/snippets')) == 1\n        events.append({'durable_snippet': after})\n" + stub[end:]
(out / 'harness_rewardkit_stub.py').write_text(stub, encoding='utf-8', newline='\n')
print('Prepared four local harness cases; all judge results are synthetic plumbing fixtures.')

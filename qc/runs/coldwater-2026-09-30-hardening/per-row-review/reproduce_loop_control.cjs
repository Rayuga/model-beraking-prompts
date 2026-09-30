const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const promptPath = '.qc-cache/coldwater-2026-09-30-hardening/task/tests/scored/functional/prompt.md';
const prompt = fs.readFileSync(promptPath, 'utf8');
const probes = [
  ['braced', "console.log('before-braced-hang');\nwhile (true) {}"],
  ['unbraced', "console.log('before-unbraced-hang');\nwhile (true);"],
  ['promise', "console.log('before-promise-hang');\nPromise.resolve().then(() => { console.log('promise-loop-entered'); while (true) {} });"],
];
for (const [, source] of probes) {
  if (!prompt.replace(/\r/g, '').includes(source)) throw Error('Frozen fixture changed');
}

async function execute(source) {
  const logs = [];
  const document = {body: {innerHTML: 'last-good-control'}};
  const earlyAbort = "throw new Error('Execution stopped: five-second time limit');";
  const broken = source.replace(/while\s*\([^)]*\)\s*\{/g, match => match + earlyAbort)
    .replace(/while\s*\([^)]*\)\s*;/g, match => match.slice(0, -1) + '{' + earlyAbort + '}');
  let error = null;
  try {
    await vm.runInNewContext(broken, {console: {log: (...args) => logs.push(args.join(' '))}, document}, {timeout: 1000});
  } catch (err) {
    error = err.message;
    document.body.innerHTML = 'last-good-control';
  }
  return {logs, error, rendered: document.body.innerHTML};
}

(async () => {
  const results = {};
  for (const [name, source] of probes) results[name] = await execute(source);
  results.recovery = await execute("document.body.innerHTML='timeout-recovered'; console.log('timeout-recovered');");
  results.finite_loop = await execute("let n=0; while(n<3) {n++;} document.body.innerHTML='finite-'+n; console.log('finite-'+n);");
  const output = {
    scope: 'Synthetic in-memory broken loop instrumenter applied to exact frozen S09 fixtures. Not a golden mutation, browser run or configured-judge grade.',
    prompt_sha256: crypto.createHash('sha256').update(fs.readFileSync(promptPath)).digest('hex'),
    results,
    conclusion: 'Early-abort loop handling preserves the requested timeout markers and ordinary recovery while rejecting a valid finite loop; S09 has no finite-loop success discriminator.',
  };
  fs.writeFileSync(path.join(__dirname, 'loop-control-source-result.json'), JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
})().catch(err => { console.error(err); process.exitCode = 1; });

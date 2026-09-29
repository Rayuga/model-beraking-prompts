const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const seed = JSON.parse(fs.readFileSync('/assets/seed_data.json'));
const appFiles = fs.readdirSync('/app').sort();
assert.deepEqual(appFiles, ['.git', '.gitkeep']);
for (const location of ['/solution', '/tests', '/app/server.js']) assert.equal(fs.existsSync(location), false);
assert.equal(require('express/package.json').version, '5.1.0');
assert.equal(require('better-sqlite3/package.json').version, '12.4.1');
const files = {};
for (const directory of ['/instructions', '/assets']) {
  for (const filename of fs.readdirSync(directory, { recursive: true })) {
    const location = directory + '/' + filename;
    if (fs.statSync(location).isFile()) files[location] = crypto.createHash('sha256').update(fs.readFileSync(location)).digest('hex');
  }
}
if (process.env.TASK_SLUG.startsWith('colderwater')) assert.deepEqual(seed.snippets, []);
else {
  assert.equal(seed.variants.length, 13);
  for (const variant of seed.variants) assert(fs.existsSync('/assets/' + variant.image));
}
console.log(JSON.stringify({ passed: true, appFiles, sourceFiles: files, node: process.version,
  express: require('express/package.json').version, sqlite: require('better-sqlite3/package.json').version,
  privateSolutionOrVerifierPresent: false }));

const fs = require('fs');
const assert = require('assert/strict');
const seed = JSON.parse(fs.readFileSync('/assets/seed_data.json'));
const appFiles = fs.readdirSync('/app').sort();
assert.deepEqual(appFiles, ['.git', '.gitkeep']);
assert.equal(fs.existsSync('/solution'), false);
assert.equal(fs.existsSync('/tests'), false);
assert.equal(seed.variants.length, 13);
assert.equal(new Set(seed.variants.map(v => v.sku)).size, 8);
assert.equal(require('express/package.json').version, '5.1.0');
assert.equal(require('better-sqlite3/package.json').version, '12.4.1');
for (const v of seed.variants) assert.ok(fs.existsSync('/assets/' + v.image));
console.log(JSON.stringify({agentImagePass:true,appFiles,variants:13,prints:8,
  instructions:fs.readdirSync('/instructions'),node:process.version,
  express:require('express/package.json').version,sqlite:require('better-sqlite3/package.json').version,
  privateSolutionOrVerifierPresent:false},null,2));

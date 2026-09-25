const { scoreHand } = require('./scoring.js');
const { SCORED_HANDS } = require('/assets/club/scored-hands.js');

let passed = 0;
let failed = 0;

console.log('Testing 40 scored hands...\n');

SCORED_HANDS.forEach((test, idx) => {
  const result = scoreHand(test.hand, test.cut, test.crib);
  const isCorrect = result.total === test.total;
  
  if (isCorrect) {
    passed++;
  } else {
    failed++;
    console.log(`✗ Hand ${idx + 1}: ${test.hand.join(', ')} + ${test.cut}`);
    console.log(`  Expected: ${test.total}, Got: ${result.total}`);
    console.log(`  Breakdown: ${JSON.stringify(result)}`);
    console.log(`  Rule: ${test.rule}`);
    console.log();
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${SCORED_HANDS.length}`);

if (failed > 0) {
  process.exit(1);
}

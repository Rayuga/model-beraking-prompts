const { app, server } = require('../server');
const { runApiTests } = require('./api.test');
const { runBrowserTests } = require('./editor.test');

const PORT = process.env.PORT || 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

async function main() {
  try {
    // Wait a moment for server to be fully ready
    await new Promise(r => setTimeout(r, 500));

    console.log(`\n========================================`);
    console.log(`   PATCHPAD TEST SUITE RUNNER`);
    console.log(`   Target: ${baseURL}`);
    console.log(`========================================\n`);

    await runApiTests(baseURL);
    await runBrowserTests(baseURL);

    console.log('🎉 ALL PATCHPAD TESTS COMPLETED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED:', err);
    process.exit(1);
  } finally {
    if (server && server.close) {
      server.close();
    }
  }
}

main();

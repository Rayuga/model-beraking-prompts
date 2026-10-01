require('node:fs').writeFileSync("/tmp/harness-proposal-controls/proposed-cleanup-term-ignored/started",String(process.pid)); process.on('SIGTERM',()=>{});setInterval(()=>{},1000);

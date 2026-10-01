require('node:fs').writeFileSync("/tmp/harness-proposal-controls/original-cleanup-term-ignored/started",String(process.pid)); process.on('SIGTERM',()=>{});setInterval(()=>{},1000);

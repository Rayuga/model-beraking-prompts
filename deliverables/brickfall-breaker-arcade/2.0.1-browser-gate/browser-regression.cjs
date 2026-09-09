const {execFileSync}=require('node:child_process');
execFileSync('node',['/results/gate-regression.cjs'],{stdio:'inherit'});
execFileSync('node',['/review/browser-regression.cjs'],{stdio:'inherit'});

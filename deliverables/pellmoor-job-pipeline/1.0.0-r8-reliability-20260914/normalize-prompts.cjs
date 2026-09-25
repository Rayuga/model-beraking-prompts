const fs = require('node:fs');
const path = require('node:path');
const task=path.resolve(__dirname,'../../../projects/pellmoor-job-pipeline');
for(const dimension of ['render','constraints','functional','polish','visual']) {
  const file=path.join(task,'tests',dimension,'prompt.md');
  let text=fs.readFileSync(file,'utf8');
  const old='Judge observable outcomes, not exact selectors, layout or undisclosed route\nnames. Continue after an individual failure and return every criterion.';
  const replacement='Evaluate each criterion independently and continue after individual failures.\nReturn a verdict for every criterion. Judge observable outcomes, not exact\nselectors, layout or undisclosed route names.';
  if(text.includes(old)) {
    text=text.replace(old,replacement);
    if(dimension!=='functional')text=text.replace(/(Prompt version: .*-r)(\d+)/,(_,prefix,n)=>prefix+(Number(n)+1));
    fs.writeFileSync(file,text);
  } else if(!text.includes(replacement)) throw new Error('Unexpected prompt paragraph: '+dimension);
}

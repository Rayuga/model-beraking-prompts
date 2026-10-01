'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {digest}=require('./workflow_core.cjs');
const root=path.resolve(__dirname,'../../../../..'),task=process.argv[4]?path.resolve(root,process.argv[4]):path.join(root,'projects/colderwater-playground-devtools');
assert(task.startsWith(root+path.sep),'Task input must remain inside the authorized workspace');
assert(process.argv[2]==='--freeze','Explicit --freeze required after parent fixture freeze');
const target=process.argv[3];assert(target,'Provide a new output manifest filename under this evidence directory');
const out=path.resolve(__dirname,'..',target);assert(out.startsWith(path.resolve(__dirname,'..')+path.sep),'Output must stay inside proof evidence');assert(!fs.existsSync(out),'Do not overwrite a prior frozen input manifest');
const prompt=fs.readFileSync(path.join(task,'tests/scored/functional/prompt.md'),'utf8'),judge=fs.readFileSync(path.join(task,'tests/scored/functional/judge.toml'),'utf8');
const headers=[...prompt.matchAll(/^### (S\d{2})[^\n]*$/gm)],scenarios={};assert(headers.length===37,'Expected37 shared scenarios');
for(let i=0;i<headers.length;i++){
  const h=headers[i],text=prompt.slice(h.index,i+1<headers.length?headers[i+1].index:prompt.indexOf('\n## Binary outcome descriptors',h.index)>0?prompt.indexOf('\n## Binary outcome descriptors',h.index):prompt.length);
  let keys=[...text.matchAll(/^- `(S\d{2}\.[^`]+)`:/gm)].map(m=>m[1]);
  if(!keys.length){const line=text.match(/^Evidence keys:\s*(.*)$/m)?.[1]??'';keys=[...line.matchAll(/`([^`]+)`/g)].map(m=>m[1].startsWith('S')?m[1]:h[1]+'.'+m[1]);}
  scenarios[h[1]]={heading:h[0],protocol:text,protocol_sha256:digest(text),evidence_keys:keys};
}
const criteria=judge.split('[[criterion]]').slice(1).map(block=>{
  const id=block.match(/^id\s*=\s*"([^"]+)"/m)?.[1],weight=Number(block.match(/^weight\s*=\s*([\d.]+)/m)?.[1]);
  const literal=block.match(/^description\s*=\s*("(?:[^"\\]|\\.)*")\s*$/m)?.[1];assert(id&&literal,'Expected compact outcome descriptor');
  const description=JSON.parse(literal),keys=[...description.matchAll(/\b(S\d{2}\.[a-z0-9_]+)/g)].map(m=>m[1]);assert(keys.length,'Descriptor needs named key');
  return{id,weight,description,evidence_keys:[...new Set(keys)],source_block_sha256:digest(block)};
});
for(const[id,scenario]of Object.entries(scenarios)){scenario.evidence_keys=[...new Set(criteria.flatMap(row=>row.evidence_keys).filter(key=>key.startsWith(id+'.')))];assert(scenario.evidence_keys.length,'No outcome references '+id);}
const files={};function scan(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name),rel=prefix+entry.name;if(entry.isDirectory())scan(full,rel+'/');else files[rel]=digest(fs.readFileSync(full));}}scan(path.join(task,'solution'));
assert(Object.keys(files).length===23,'Unexpected golden solution file set');
const manifest={freeze_confirmed:true,created_at:new Date().toISOString(),provider_or_platform:false,functional_sha256:digest(judge),prompt_sha256:digest(prompt),context_sha256:digest(fs.readFileSync(path.join(task,'tests/app_context.md'))),restart_script_sha256:digest(fs.readFileSync(path.join(task,'tests/test.sh'))),restart_mcp_sha256:digest(fs.readFileSync(path.join(task,'tests/tools/restart_mcp.py'))),solution_files:files,criteria,scenarios,scope:'Fresh reference proof fixtures; not an Oracle verdict. Criterion hashes here are explicitly source-block hashes, not Python canonical criterion hashes.'};
fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({output:out,criteria:criteria.length,weight:criteria.reduce((sum,c)=>sum+c.weight,0),scenarios:headers.length,solution_files:Object.keys(files).length,prompt_sha256:manifest.prompt_sha256},null,2));

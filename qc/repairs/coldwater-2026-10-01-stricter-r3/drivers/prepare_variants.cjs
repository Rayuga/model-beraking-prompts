'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {digest}=require('./workflow_core.cjs'),mutations=require('./variant_mutations.cjs');
const root=path.resolve(__dirname,'../../../../..'),app=path.join(root,'projects/colderwater-playground-devtools/solution/app');
assert(process.argv[2]==='--freeze','Explicit --freeze required after fixture freeze');
const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',process.argv[3])));assert(manifest.freeze_confirmed);
const variantsDir=path.resolve(__dirname,'../variants');assert(!fs.existsSync(variantsDir),'Never overwrite an existing variant build');
const before=Object.fromEntries(Object.keys(manifest.solution_files).filter(key=>key.startsWith('app/')).map(key=>[key.slice(4),digest(fs.readFileSync(path.join(app,key.slice(4))))]));
for(const[rel,hash]of Object.entries(before))assert.equal(hash,manifest.solution_files['app/'+rel],'Source drift: '+rel);
const variants=[['server-extension','server.js','serverExtensionValidationBypass'],['title-nocase','server.js','serverCaseInsensitiveUniqueness'],['css-handlers','src/runtime.ts','cssLiveContextInheritance']];
const report={freeze_manifest_sha256:digest(fs.readFileSync(path.resolve(__dirname,'..',process.argv[3]))),runtime_executed:false,variants:[]};
for(const[name,relative,transform]of variants){
  const dest=path.join(variantsDir,name,'app');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(app,dest,{recursive:true});
  const sourceFile=path.join(dest,relative),source=fs.readFileSync(sourceFile,'utf8'),changed=mutations[transform](source);fs.writeFileSync(sourceFile,changed);
  const row={name,transform,mutated_file:relative,before_sha256:digest(source),after_sha256:digest(changed),path:dest};
  if(name==='css-handlers'){
    const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');
    assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
    const build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});
    fs.writeFileSync(path.join(variantsDir,name,'build.log'),build.stdout+build.stderr);assert.equal(build.status,0,build.stderr);row.build={vite:'7.1.7',network:false,status:build.status};
  }
  const files={};const scan=(dir,prefix='')=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name),rel=prefix+ent.name;if(ent.isDirectory())scan(full,rel+'/');else files[rel]=digest(fs.readFileSync(full));}};scan(dest);row.solution_app_files=files;report.variants.push(row);
}
for(const[rel,hash]of Object.entries(before))assert.equal(digest(fs.readFileSync(path.join(app,rel))),hash,'Shipped app changed: '+rel);
fs.writeFileSync(path.join(variantsDir,'variant_binding.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.variants.map(({name,mutated_file,before_sha256,after_sha256})=>({name,mutated_file,before_sha256,after_sha256})),null,2));

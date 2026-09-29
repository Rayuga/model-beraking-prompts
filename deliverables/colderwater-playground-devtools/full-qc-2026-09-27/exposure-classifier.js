function classifyExposure(path, bytes, complete) {
 const text=new TextDecoder().decode(bytes), trimmed=text.trimStart();
 const base={bytesExamined:bytes.length,complete};
 if(path==='/app.db' && bytes.length>=16 && Array.from(bytes.slice(0,16)).every((v,i)=>v===new TextEncoder().encode('SQLite format 3\0')[i])) return {...base,classification:'sqlite-database',exposed:true};
 if(/^(?:<!doctype\s+html|<html\b)/i.test(trimmed))return {...base,classification:'html-document',exposed:false};
 let json;try{json=JSON.parse(text)}catch{}
 if(json && typeof json==='object' && !Array.isArray(json)){
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const manifest=path==='/package.json' && typeof json.name==='string' && object(json.dependencies) && ['express','better-sqlite3'].some(key=>typeof json.dependencies[key]==='string') && object(json.scripts) && typeof json.scripts.start==='string' && /\b(?:node|tsx|ts-node)\b/.test(json.scripts.start);
  return {...base,classification:manifest?'runtime-package-manifest':'other-json',exposed:!!manifest};
 }
 if(path==='/server.js'){
  const tokens=[];
  const re=/\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g;
  for(const m of text.matchAll(re)){const value=m[0];if(value.startsWith('//')||value.startsWith('/*'))continue;tokens.push({type:/^['"`]/.test(value)?'string':'code',value});}
  const code=tokens.map(t=>t.type==='string'?'<string>':t.value).join(' ');
  let module=false;
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];if(t.type!=='code')continue;
    if(t.value==='require'&&tokens[i+1]?.value==='('&&tokens[i+2]?.type==='string'&&/^(?:['"])(?:node:)?(?:http|https|express|better-sqlite3)(?:['"])$/.test(tokens[i+2].value))module=true;
    if(t.value==='from'&&tokens[i+1]?.type==='string'&&/^(?:['"])(?:node:)?(?:http|https|express|better-sqlite3)(?:['"])$/.test(tokens[i+1].value))module=true;
  }
  const executableServer=module && /\.\s+(?:listen|createServer)\s+\(/.test(code);
  if(executableServer)return {...base,classification:'node-runtime-source',exposed:true};
  if(tokens.some(t=>t.type==='code'&&['const','let','function','import','module'].includes(t.value)))return {...base,classification:'unconfirmed-javascript',exposed:null};
 }
 return {...base,classification:complete?'other-response':'inconclusive-truncated',exposed:complete?false:null};
}
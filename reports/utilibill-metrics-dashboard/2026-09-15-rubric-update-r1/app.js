'use strict';
const ROLE_LABELS = {meter_analyst:'Meter-data Analyst',billing_operator:'Billing Operator',rate_admin:'Rate Administrator',settlement_controller:'Settlement Controller'};
const ALL_WORKSPACES = [{id:'dashboard',label:'Dashboard'},{id:'accounts',label:'Accounts'},{id:'settlement',label:'Settlement'},{id:'audit',label:'Audit'}];
const $ = (s,r=document) => r.querySelector(s);
const el = (tag,props={},kids=[]) => {
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(props)) {
    if(k==='class') n.className=v;
    else if(k==='text') n.textContent=v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2),v);
    else if(v!=null) n.setAttribute(k,v);
  }
  for(const kid of [].concat(kids)) if(kid!=null) n.append(kid);
  return n;
};
let STATE={user:null,boot:null,view:'dashboard'}, DETAIL=null, returnFocus=null;
async function api(method,path,body) {
  try {
    const res=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
    let data=null; try {data=await res.json();} catch {}
    if(res.status===401 && path!=='/api/auth/login') showLogin();
    return {ok:res.ok,status:res.status,data};
  } catch {return {ok:false,status:0,data:{error:'Could not reach the server. Please try again.'}};}
}
function summarize(obj) {
  if(!obj || typeof obj!=='object') return String(obj);
  const bits=[];
  for(const key of ['account_id','cycle_id','bill_id','period_id','state','status','total_display','settled_display','new_levelized_display']) if(obj[key]!=null) bits.push(`${key.replace(/_/g,' ')}: ${obj[key]}`);
  return bits.length?bits.join(' · '):'Action completed successfully.';
}
function flash(msg,kind='info') {
  const text=typeof msg==='string'?msg:msg?.error||summarize(msg);
  for(const box of [$('#flash'),$('#detail-status')]) box.replaceChildren(el('div',{class:`flash ${kind}`,text,role:kind==='error'?'alert':'status'}));
}
function actionButton(label,method,path,bodyFn,opts={}) {
  const button=el('button',{class:`action${opts.secondary?' secondary':''} small`,type:'button'},[label]);
  button.addEventListener('click',async()=>{
    if(button.disabled) return;
    let body; try {body=bodyFn?bodyFn():undefined;} catch(e) {flash(e.message,'error');return;}
    if(body===false) return;
    button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Working…';flash('Saving the change…');
    const r=await api(method,typeof path==='function'?path():path,body);
    if(STATE.user) {
      flash(r.data||`Request failed (${r.status}).`,r.ok?'ok':'error');
      const loaded=await refresh();
      if(!loaded.ok && r.ok && STATE.user) flash('Saved, but the latest view could not load. Reload to try again.','error');
    }
    button.disabled=false;button.removeAttribute('aria-busy');button.textContent=label;
  });
  return button;
}
function paintDetail() {
  if(!DETAIL) return;
  const body=$('#detail-body'),scroll=$('#detail-drawer').scrollTop,hadFocus=body.contains(document.activeElement);
  body.replaceChildren(...(typeof DETAIL.nodes==='function'?DETAIL.nodes():DETAIL.nodes));
  $('#detail-drawer').scrollTop=scroll;
  if(hadFocus) $('#detail-close').focus({preventScroll:true});
}
function openDetail(title,nodes) {
  returnFocus=document.activeElement;DETAIL={title,nodes};
  $('#detail-title').textContent=title;$('#detail-status').replaceChildren();paintDetail();
  $('#detail-backdrop').hidden=false;$('#main').inert=true;$('#topbar').inert=true;
  document.body.style.overflow='hidden';$('#detail-close').focus();
}
function closeDetail() {
  const wasOpen=!$('#detail-backdrop').hidden;
  DETAIL=null;$('#detail-backdrop').hidden=true;$('#detail-body').replaceChildren();$('#detail-status').replaceChildren();
  $('#main').inert=false;$('#topbar').inert=false;document.body.style.overflow='';
  if(wasOpen) (returnFocus?.isConnected?returnFocus:$('#nav button.active'))?.focus();
  returnFocus=null;
}
function setView(view) {STATE.view=view;$('#flash').replaceChildren();renderNav();renderAll();}
function renderNav() {
  $('#nav').replaceChildren(...ALL_WORKSPACES.map(ws=>el('button',{type:'button','data-view':ws.id,'aria-current':STATE.view===ws.id?'page':'false',class:STATE.view===ws.id?'active':'',onclick:()=>setView(ws.id)},[ws.label])));
}
function renderAll() {
  const pages=window.renderWorkspaces(STATE.boot,{el,actionButton,openDetail,closeDetail,api,flash,refresh});
  for(const page of pages) page.classList.toggle('active',STATE.view===page.dataset.workspace);
  $('#workspace').replaceChildren(...pages);paintDetail();
}
async function refresh() {
  const r=await api('GET','/api/bootstrap');
  if(r.ok) {STATE.boot=r.data;STATE.user=r.data.user;renderNav();renderAll();showApp();}
  else if(STATE.user) flash(r.data||'Unable to load the workspace.','error');
  return r;
}
function applyTheme(theme) {
  document.documentElement.dataset.theme=theme==='dark'?'dark':'light';
  try {localStorage.setItem('utilibill-theme',theme);} catch {}
  $('#theme-toggle').textContent=theme==='dark'?'Light mode':'Dark mode';
}
function showApp() {
  $('#login-view').hidden=true;$('#app-view').hidden=false;$('#logout').hidden=false;
  $('#who').textContent=`${STATE.user.name} · ${ROLE_LABELS[STATE.user.role]||STATE.user.role}`;
}
function showLogin() {
  closeDetail();STATE={user:null,boot:null,view:'dashboard'};
  $('#login-view').hidden=false;$('#app-view').hidden=true;$('#logout').hidden=true;$('#who').textContent='';
  $('#nav').replaceChildren();$('#workspace').replaceChildren();$('#flash').replaceChildren();
}
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const submit=e.currentTarget.querySelector('button');if(submit.disabled) return;
  submit.disabled=true;$('#login-error').textContent='';
  const r=await api('POST','/api/auth/login',{email:$('#email').value,password:$('#password').value});
  if(r.ok) {STATE.user=r.data;const loaded=await refresh();if(!loaded.ok) $('#login-error').textContent='Signed in, but could not load the workspace. Try again.';}
  else $('#login-error').textContent=r.data?.error||'Sign-in failed.';
  submit.disabled=false;
});
$('#logout').addEventListener('click',async()=>{const r=await api('POST','/api/auth/logout');if(r.ok||r.status===401) showLogin();else flash(r.data||'Could not sign out. Please try again.','error');});
$('#theme-toggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#detail-close').addEventListener('click',closeDetail);
$('#detail-backdrop').addEventListener('click',e=>{if(e.target===$('#detail-backdrop')) closeDetail();});
document.addEventListener('keydown',e=>{
  if(!DETAIL) return;
  if(e.key==='Escape') {e.preventDefault();closeDetail();return;}
  if(e.key!=='Tab') return;
  const items=[...$('#detail-drawer').querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(n=>n.getClientRects().length);
  const first=items[0],last=items[items.length-1];
  if(e.shiftKey&&document.activeElement===first) {e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last) {e.preventDefault();first.focus();}
});
(async()=>{let theme='light';try{theme=localStorage.getItem('utilibill-theme')||theme;}catch{}applyTheme(theme);const me=await api('GET','/api/auth/me');if(me.ok){STATE.user=me.data;await refresh();}else showLogin();})();

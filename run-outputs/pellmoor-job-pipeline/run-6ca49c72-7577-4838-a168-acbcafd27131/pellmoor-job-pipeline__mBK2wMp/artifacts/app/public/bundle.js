"use strict";(()=>{var mn=localStorage.getItem("pellmoor_auth_token");function ke(t){mn=t,t?localStorage.setItem("pellmoor_auth_token",t):localStorage.removeItem("pellmoor_auth_token")}function gn(){return mn||localStorage.getItem("pellmoor_auth_token")}function L(){return typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():"op-"+Math.random().toString(36).substring(2,11)+"-"+Date.now().toString(36)}async function D(t,e,n={}){let r={Accept:"application/json"},i=gn();i&&(r.Authorization=`Bearer ${i}`),n.operationId&&(r["Idempotency-Key"]=n.operationId),n.expectedRevision!==void 0&&n.expectedRevision!==null&&(r["X-Expected-Revision"]=String(n.expectedRevision));let s;if(n.body){r["Content-Type"]="application/json";let c={...n.body};n.expectedRevision!==void 0&&n.expectedRevision!==null&&!("expected_revision"in c)&&(c.expected_revision=n.expectedRevision),s=JSON.stringify(c)}let a=await fetch(e,{method:t,headers:r,body:s}),o=null;if((a.headers.get("content-type")||"").includes("application/json"))try{o=await a.json()}catch{o=null}else o=await a.text();if(!a.ok){let c=o&&typeof o=="object"&&o.error?o.error:`Request failed with status ${a.status}`;throw{status:a.status,message:c,reasons:o?.reasons,currentRevision:o?.current_revision,data:o}}return o}async function vn(t,e){let n=await D("POST","/api/auth/login",{body:{email:t,password:e}});return ke(n.token),n}async function yn(){try{await D("POST","/api/auth/logout")}finally{ke(null)}}async function bn(){if(!gn())return null;try{return(await D("GET","/api/auth/me")).user}catch(t){return t.status===401&&ke(null),null}}async function xn(){return(await D("GET","/api/vacancies")).vacancies}async function wn(t){return await D("GET",`/api/vacancies/${encodeURIComponent(t)}`)}async function _n(t,e,n,r){return await D("POST","/api/candidates",{body:{vacancy_code:t,name:e},expectedRevision:n,operationId:r})}async function kn(t,e,n,r){return await D("POST",`/api/candidates/${encodeURIComponent(t)}/stage`,{body:{target_stage:e},expectedRevision:n,operationId:r})}async function Se(t,e,n,r,i){return await D("POST",`/api/candidates/${encodeURIComponent(t)}/panel`,{body:{action:e,member_email:n},expectedRevision:r,operationId:i})}async function Sn(t,e,n,r){return await D("POST",`/api/candidates/${encodeURIComponent(t)}/scores`,{body:{score:e},expectedRevision:n,operationId:r})}async function Cn(t,e,n,r){return await D("POST",`/api/candidates/${encodeURIComponent(t)}/notes`,{body:{text:e},expectedRevision:n,operationId:r})}async function Ce(t,e){return await D("POST",`/api/vacancies/${encodeURIComponent(t)}/batch-offers/preview`,{body:{candidate_ids:e}})}async function $n(t,e,n,r){return await D("POST",`/api/vacancies/${encodeURIComponent(t)}/batch-offers`,{body:{candidate_ids:e},expectedRevision:n,operationId:r})}function Bi(){let t=localStorage.getItem("pellmoor_theme");return t==="light"||t==="dark"?t:typeof window<"u"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function Hi(t){document.documentElement.setAttribute("data-theme",t),localStorage.setItem("pellmoor_theme",t),window.dispatchEvent(new CustomEvent("theme-changed",{detail:{theme:t}}))}function En(){let e=(document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light")==="dark"?"light":"dark";return Hi(e),e}function Mn(){let t=Bi();document.documentElement.setAttribute("data-theme",t)}function An(t,e,n){let r=document.documentElement.getAttribute("data-theme")||"light";t.innerHTML=`
    <header class="app-header">
      <div class="header-brand">
        <div class="brand-logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div class="brand-text">
          <h1 class="brand-title">Pellmoor Hiring Workspace</h1>
          <span class="brand-tagline">Pipeline & Assessment Control</span>
        </div>
      </div>

      <div class="header-controls">
        <button id="theme-toggle-btn" class="theme-toggle-btn" aria-label="Toggle light or dark theme" title="Switch Theme">
          <span class="theme-icon light-icon" aria-hidden="true">\u2600\uFE0F</span>
          <span class="theme-icon dark-icon" aria-hidden="true">\u{1F319}</span>
          <span class="theme-label">${r==="dark"?"Dark":"Light"}</span>
        </button>

        ${e?`
          <div class="user-profile-badge">
            <div class="user-avatar" aria-hidden="true">${e.name.charAt(0)}</div>
            <div class="user-info">
              <span class="user-name">${e.name}</span>
              <span class="user-role-tag role-${e.role.replace(" ","-")}">${e.role}</span>
            </div>
          </div>
          <button id="logout-btn" class="btn btn-sm btn-outline" title="Sign Out">Sign Out</button>
        `:""}
      </div>
    </header>
  `;let i=t.querySelector("#theme-toggle-btn");i&&i.addEventListener("click",()=>{let a=En(),o=t.querySelector(".theme-label");o&&(o.textContent=a==="dark"?"Dark":"Light")});let s=t.querySelector("#logout-btn");s&&s.addEventListener("click",()=>{n.onLogout()})}function Tn(t,e){t.innerHTML=`
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="login-brand-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <h2 class="login-title">Sign In to Pellmoor</h2>
          <p class="login-desc">Select a demo account or sign in with your credentials.</p>
        </div>

        <div id="login-error-msg" class="login-error-box" style="display: none;"></div>

        <div class="demo-accounts-grid">
          <button class="demo-account-btn" data-email="hiring@pellmoor.test" data-pass="password123">
            <div class="demo-name">Ruth Aldane</div>
            <div class="demo-role role-hiring-manager">Hiring Manager</div>
            <div class="demo-email">hiring@pellmoor.test</div>
          </button>

          <button class="demo-account-btn" data-email="coord@pellmoor.test" data-pass="password123">
            <div class="demo-name">Cal Meriden</div>
            <div class="demo-role role-coordinator">Coordinator</div>
            <div class="demo-email">coord@pellmoor.test</div>
          </button>

          <button class="demo-account-btn" data-email="panel1@pellmoor.test" data-pass="password123">
            <div class="demo-name">Otis Barre</div>
            <div class="demo-role role-panel">Panel Member</div>
            <div class="demo-email">panel1@pellmoor.test</div>
          </button>

          <button class="demo-account-btn" data-email="panel2@pellmoor.test" data-pass="password123">
            <div class="demo-name">Wren Foss</div>
            <div class="demo-role role-panel">Panel Member</div>
            <div class="demo-email">panel2@pellmoor.test</div>
          </button>
        </div>

        <div class="login-divider"><span>or sign in manually</span></div>

        <form id="manual-login-form" class="manual-login-form">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-input" placeholder="name@pellmoor.test" required>
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" class="form-input" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required>
          </div>

          <button type="submit" id="login-submit-btn" class="btn btn-primary btn-block">Sign In</button>
        </form>
      </div>
    </div>
  `;let n=t.querySelector("#login-error-msg"),r=o=>{n&&(n.textContent=o,n.style.display="block")},i=async(o,l)=>{try{n.style.display="none";let c=await vn(o,l);e.onLoginSuccess(c.user)}catch(c){r(c.message||"Login failed. Please check your credentials.")}};t.querySelectorAll(".demo-account-btn").forEach(o=>{o.addEventListener("click",()=>{let l=o.getAttribute("data-email"),c=o.getAttribute("data-pass");l&&c&&i(l,c)})});let a=t.querySelector("#manual-login-form");a&&a.addEventListener("submit",o=>{o.preventDefault();let l=t.querySelector("#login-email"),c=t.querySelector("#login-password");l&&c&&i(l.value.trim(),c.value)})}function K(t,e){return t==null||e==null?NaN:t<e?-1:t>e?1:t>=e?0:NaN}function $e(t,e){return t==null||e==null?NaN:e<t?-1:e>t?1:e>=t?0:NaN}function Nt(t){let e,n,r;t.length!==2?(e=K,n=(o,l)=>K(t(o),l),r=(o,l)=>t(o)-l):(e=t===K||t===$e?t:zi,n=t,r=t);function i(o,l,c=0,u=o.length){if(c<u){if(e(l,l)!==0)return u;do{let f=c+u>>>1;n(o[f],l)<0?c=f+1:u=f}while(c<u)}return c}function s(o,l,c=0,u=o.length){if(c<u){if(e(l,l)!==0)return u;do{let f=c+u>>>1;n(o[f],l)<=0?c=f+1:u=f}while(c<u)}return c}function a(o,l,c=0,u=o.length){let f=i(o,l,c,u-1);return f>c&&r(o[f-1],l)>-r(o[f],l)?f-1:f}return{left:i,center:a,right:s}}function zi(){return 0}function Ee(t){return t===null?NaN:+t}var In=Nt(K),Vn=In.right,Fi=In.left,qi=Nt(Ee).center,Me=Vn;var st=class extends Map{constructor(e,n=Yi){if(super(),Object.defineProperties(this,{_intern:{value:new Map},_key:{value:n}}),e!=null)for(let[r,i]of e)this.set(r,i)}get(e){return super.get(Dn(this,e))}has(e){return super.has(Dn(this,e))}set(e,n){return super.set(Ui(this,e),n)}delete(e){return super.delete(Xi(this,e))}};function Dn({_intern:t,_key:e},n){let r=e(n);return t.has(r)?t.get(r):n}function Ui({_intern:t,_key:e},n){let r=e(n);return t.has(r)?t.get(r):(t.set(r,n),n)}function Xi({_intern:t,_key:e},n){let r=e(n);return t.has(r)&&(n=t.get(r),t.delete(r)),n}function Yi(t){return t!==null&&typeof t=="object"?t.valueOf():t}var Gi=Math.sqrt(50),Wi=Math.sqrt(10),ji=Math.sqrt(2);function Pt(t,e,n){let r=(e-t)/Math.max(0,n),i=Math.floor(Math.log10(r)),s=r/Math.pow(10,i),a=s>=Gi?10:s>=Wi?5:s>=ji?2:1,o,l,c;return i<0?(c=Math.pow(10,-i)/a,o=Math.round(t*c),l=Math.round(e*c),o/c<t&&++o,l/c>e&&--l,c=-c):(c=Math.pow(10,i)*a,o=Math.round(t/c),l=Math.round(e/c),o*c<t&&++o,l*c>e&&--l),l<o&&.5<=n&&n<2?Pt(t,e,n*2):[o,l,c]}function Bt(t,e,n){if(e=+e,t=+t,n=+n,!(n>0))return[];if(t===e)return[t];let r=e<t,[i,s,a]=r?Pt(e,t,n):Pt(t,e,n);if(!(s>=i))return[];let o=s-i+1,l=new Array(o);if(r)if(a<0)for(let c=0;c<o;++c)l[c]=(s-c)/-a;else for(let c=0;c<o;++c)l[c]=(s-c)*a;else if(a<0)for(let c=0;c<o;++c)l[c]=(i+c)/-a;else for(let c=0;c<o;++c)l[c]=(i+c)*a;return l}function pt(t,e,n){return e=+e,t=+t,n=+n,Pt(t,e,n)[2]}function Ae(t,e,n){e=+e,t=+t,n=+n;let r=e<t,i=r?pt(e,t,n):pt(t,e,n);return(r?-1:1)*(i<0?1/-i:i)}function Ht(t,e){let n;if(e===void 0)for(let r of t)r!=null&&(n<r||n===void 0&&r>=r)&&(n=r);else{let r=-1;for(let i of t)(i=e(i,++r,t))!=null&&(n<i||n===void 0&&i>=i)&&(n=i)}return n}function zt(t,e,n){t=+t,e=+e,n=(i=arguments.length)<2?(e=t,t=0,1):i<3?1:+n;for(var r=-1,i=Math.max(0,Math.ceil((e-t)/n))|0,s=new Array(i);++r<i;)s[r]=t+r*n;return s}function Ln(t){return t}var Te=1,Ie=2,Ve=3,ht=4,On=1e-6;function Ki(t){return"translate("+t+",0)"}function Qi(t){return"translate(0,"+t+")"}function Zi(t){return e=>+t(e)}function Ji(t,e){return e=Math.max(0,t.bandwidth()-e*2)/2,t.round()&&(e=Math.round(e)),n=>+t(n)+e}function ta(){return!this.__axis}function Rn(t,e){var n=[],r=null,i=null,s=6,a=6,o=3,l=typeof window<"u"&&window.devicePixelRatio>1?0:.5,c=t===Te||t===ht?-1:1,u=t===ht||t===Ie?"x":"y",f=t===Te||t===Ve?Ki:Qi;function d(p){var h=r??(e.ticks?e.ticks.apply(e,n):e.domain()),v=i??(e.tickFormat?e.tickFormat.apply(e,n):Ln),m=Math.max(s,0)+o,y=e.range(),k=+y[0]+l,S=+y[y.length-1]+l,w=(e.bandwidth?Ji:Zi)(e.copy(),l),E=p.selection?p.selection():p,b=E.selectAll(".domain").data([null]),A=E.selectAll(".tick").data(h,e).order(),it=A.exit(),W=A.enter().append("g").attr("class","tick"),j=A.select("line"),q=A.select("text");b=b.merge(b.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),A=A.merge(W),j=j.merge(W.append("line").attr("stroke","currentColor").attr(u+"2",c*s)),q=q.merge(W.append("text").attr("fill","currentColor").attr(u,c*m).attr("dy",t===Te?"0em":t===Ve?"0.71em":"0.32em")),p!==E&&(b=b.transition(p),A=A.transition(p),j=j.transition(p),q=q.transition(p),it=it.transition(p).attr("opacity",On).attr("transform",function(g){return isFinite(g=w(g))?f(g+l):this.getAttribute("transform")}),W.attr("opacity",On).attr("transform",function(g){var I=this.parentNode.__axis;return f((I&&isFinite(I=I(g))?I:w(g))+l)})),it.remove(),b.attr("d",t===ht||t===Ie?a?"M"+c*a+","+k+"H"+l+"V"+S+"H"+c*a:"M"+l+","+k+"V"+S:a?"M"+k+","+c*a+"V"+l+"H"+S+"V"+c*a:"M"+k+","+l+"H"+S),A.attr("opacity",1).attr("transform",function(g){return f(w(g)+l)}),j.attr(u+"2",c*s),q.attr(u,c*m).text(v),E.filter(ta).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",t===Ie?"start":t===ht?"end":"middle"),E.each(function(){this.__axis=w})}return d.scale=function(p){return arguments.length?(e=p,d):e},d.ticks=function(){return n=Array.from(arguments),d},d.tickArguments=function(p){return arguments.length?(n=p==null?[]:Array.from(p),d):n.slice()},d.tickValues=function(p){return arguments.length?(r=p==null?null:Array.from(p),d):r&&r.slice()},d.tickFormat=function(p){return arguments.length?(i=p,d):i},d.tickSize=function(p){return arguments.length?(s=a=+p,d):s},d.tickSizeInner=function(p){return arguments.length?(s=+p,d):s},d.tickSizeOuter=function(p){return arguments.length?(a=+p,d):a},d.tickPadding=function(p){return arguments.length?(o=+p,d):o},d.offset=function(p){return arguments.length?(l=+p,d):l},d}function De(t){return Rn(Ve,t)}function Le(t){return Rn(ht,t)}var ea={value:()=>{}};function Pn(){for(var t=0,e=arguments.length,n={},r;t<e;++t){if(!(r=arguments[t]+"")||r in n||/[\s.]/.test(r))throw new Error("illegal type: "+r);n[r]=[]}return new Ft(n)}function Ft(t){this._=t}function na(t,e){return t.trim().split(/^|\s+/).map(function(n){var r="",i=n.indexOf(".");if(i>=0&&(r=n.slice(i+1),n=n.slice(0,i)),n&&!e.hasOwnProperty(n))throw new Error("unknown type: "+n);return{type:n,name:r}})}Ft.prototype=Pn.prototype={constructor:Ft,on:function(t,e){var n=this._,r=na(t+"",n),i,s=-1,a=r.length;if(arguments.length<2){for(;++s<a;)if((i=(t=r[s]).type)&&(i=ra(n[i],t.name)))return i;return}if(e!=null&&typeof e!="function")throw new Error("invalid callback: "+e);for(;++s<a;)if(i=(t=r[s]).type)n[i]=Nn(n[i],t.name,e);else if(e==null)for(i in n)n[i]=Nn(n[i],t.name,null);return this},copy:function(){var t={},e=this._;for(var n in e)t[n]=e[n].slice();return new Ft(t)},call:function(t,e){if((i=arguments.length-2)>0)for(var n=new Array(i),r=0,i,s;r<i;++r)n[r]=arguments[r+2];if(!this._.hasOwnProperty(t))throw new Error("unknown type: "+t);for(s=this._[t],r=0,i=s.length;r<i;++r)s[r].value.apply(e,n)},apply:function(t,e,n){if(!this._.hasOwnProperty(t))throw new Error("unknown type: "+t);for(var r=this._[t],i=0,s=r.length;i<s;++i)r[i].value.apply(e,n)}};function ra(t,e){for(var n=0,r=t.length,i;n<r;++n)if((i=t[n]).name===e)return i.value}function Nn(t,e,n){for(var r=0,i=t.length;r<i;++r)if(t[r].name===e){t[r]=ea,t=t.slice(0,r).concat(t.slice(r+1));break}return n!=null&&t.push({name:e,value:n}),t}var Oe=Pn;var qt="http://www.w3.org/1999/xhtml",Re={svg:"http://www.w3.org/2000/svg",xhtml:qt,xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};function H(t){var e=t+="",n=e.indexOf(":");return n>=0&&(e=t.slice(0,n))!=="xmlns"&&(t=t.slice(n+1)),Re.hasOwnProperty(e)?{space:Re[e],local:t}:t}function ia(t){return function(){var e=this.ownerDocument,n=this.namespaceURI;return n===qt&&e.documentElement.namespaceURI===qt?e.createElement(t):e.createElementNS(n,t)}}function aa(t){return function(){return this.ownerDocument.createElementNS(t.space,t.local)}}function Ut(t){var e=H(t);return(e.local?aa:ia)(e)}function sa(){}function Q(t){return t==null?sa:function(){return this.querySelector(t)}}function Bn(t){typeof t!="function"&&(t=Q(t));for(var e=this._groups,n=e.length,r=new Array(n),i=0;i<n;++i)for(var s=e[i],a=s.length,o=r[i]=new Array(a),l,c,u=0;u<a;++u)(l=s[u])&&(c=t.call(l,l.__data__,u,s))&&("__data__"in l&&(c.__data__=l.__data__),o[u]=c);return new x(r,this._parents)}function Ne(t){return t==null?[]:Array.isArray(t)?t:Array.from(t)}function oa(){return[]}function mt(t){return t==null?oa:function(){return this.querySelectorAll(t)}}function ca(t){return function(){return Ne(t.apply(this,arguments))}}function Hn(t){typeof t=="function"?t=ca(t):t=mt(t);for(var e=this._groups,n=e.length,r=[],i=[],s=0;s<n;++s)for(var a=e[s],o=a.length,l,c=0;c<o;++c)(l=a[c])&&(r.push(t.call(l,l.__data__,c,a)),i.push(l));return new x(r,i)}function gt(t){return function(){return this.matches(t)}}function Xt(t){return function(e){return e.matches(t)}}var la=Array.prototype.find;function ua(t){return function(){return la.call(this.children,t)}}function da(){return this.firstElementChild}function zn(t){return this.select(t==null?da:ua(typeof t=="function"?t:Xt(t)))}var fa=Array.prototype.filter;function pa(){return Array.from(this.children)}function ha(t){return function(){return fa.call(this.children,t)}}function Fn(t){return this.selectAll(t==null?pa:ha(typeof t=="function"?t:Xt(t)))}function qn(t){typeof t!="function"&&(t=gt(t));for(var e=this._groups,n=e.length,r=new Array(n),i=0;i<n;++i)for(var s=e[i],a=s.length,o=r[i]=[],l,c=0;c<a;++c)(l=s[c])&&t.call(l,l.__data__,c,s)&&o.push(l);return new x(r,this._parents)}function Yt(t){return new Array(t.length)}function Un(){return new x(this._enter||this._groups.map(Yt),this._parents)}function vt(t,e){this.ownerDocument=t.ownerDocument,this.namespaceURI=t.namespaceURI,this._next=null,this._parent=t,this.__data__=e}vt.prototype={constructor:vt,appendChild:function(t){return this._parent.insertBefore(t,this._next)},insertBefore:function(t,e){return this._parent.insertBefore(t,e)},querySelector:function(t){return this._parent.querySelector(t)},querySelectorAll:function(t){return this._parent.querySelectorAll(t)}};function Xn(t){return function(){return t}}function ma(t,e,n,r,i,s){for(var a=0,o,l=e.length,c=s.length;a<c;++a)(o=e[a])?(o.__data__=s[a],r[a]=o):n[a]=new vt(t,s[a]);for(;a<l;++a)(o=e[a])&&(i[a]=o)}function ga(t,e,n,r,i,s,a){var o,l,c=new Map,u=e.length,f=s.length,d=new Array(u),p;for(o=0;o<u;++o)(l=e[o])&&(d[o]=p=a.call(l,l.__data__,o,e)+"",c.has(p)?i[o]=l:c.set(p,l));for(o=0;o<f;++o)p=a.call(t,s[o],o,s)+"",(l=c.get(p))?(r[o]=l,l.__data__=s[o],c.delete(p)):n[o]=new vt(t,s[o]);for(o=0;o<u;++o)(l=e[o])&&c.get(d[o])===l&&(i[o]=l)}function va(t){return t.__data__}function Yn(t,e){if(!arguments.length)return Array.from(this,va);var n=e?ga:ma,r=this._parents,i=this._groups;typeof t!="function"&&(t=Xn(t));for(var s=i.length,a=new Array(s),o=new Array(s),l=new Array(s),c=0;c<s;++c){var u=r[c],f=i[c],d=f.length,p=ya(t.call(u,u&&u.__data__,c,r)),h=p.length,v=o[c]=new Array(h),m=a[c]=new Array(h),y=l[c]=new Array(d);n(u,f,v,m,y,p,e);for(var k=0,S=0,w,E;k<h;++k)if(w=v[k]){for(k>=S&&(S=k+1);!(E=m[S])&&++S<h;);w._next=E||null}}return a=new x(a,r),a._enter=o,a._exit=l,a}function ya(t){return typeof t=="object"&&"length"in t?t:Array.from(t)}function Gn(){return new x(this._exit||this._groups.map(Yt),this._parents)}function Wn(t,e,n){var r=this.enter(),i=this,s=this.exit();return typeof t=="function"?(r=t(r),r&&(r=r.selection())):r=r.append(t+""),e!=null&&(i=e(i),i&&(i=i.selection())),n==null?s.remove():n(s),r&&i?r.merge(i).order():i}function jn(t){for(var e=t.selection?t.selection():t,n=this._groups,r=e._groups,i=n.length,s=r.length,a=Math.min(i,s),o=new Array(i),l=0;l<a;++l)for(var c=n[l],u=r[l],f=c.length,d=o[l]=new Array(f),p,h=0;h<f;++h)(p=c[h]||u[h])&&(d[h]=p);for(;l<i;++l)o[l]=n[l];return new x(o,this._parents)}function Kn(){for(var t=this._groups,e=-1,n=t.length;++e<n;)for(var r=t[e],i=r.length-1,s=r[i],a;--i>=0;)(a=r[i])&&(s&&a.compareDocumentPosition(s)^4&&s.parentNode.insertBefore(a,s),s=a);return this}function Qn(t){t||(t=ba);function e(f,d){return f&&d?t(f.__data__,d.__data__):!f-!d}for(var n=this._groups,r=n.length,i=new Array(r),s=0;s<r;++s){for(var a=n[s],o=a.length,l=i[s]=new Array(o),c,u=0;u<o;++u)(c=a[u])&&(l[u]=c);l.sort(e)}return new x(i,this._parents).order()}function ba(t,e){return t<e?-1:t>e?1:t>=e?0:NaN}function Zn(){var t=arguments[0];return arguments[0]=this,t.apply(null,arguments),this}function Jn(){return Array.from(this)}function tr(){for(var t=this._groups,e=0,n=t.length;e<n;++e)for(var r=t[e],i=0,s=r.length;i<s;++i){var a=r[i];if(a)return a}return null}function er(){let t=0;for(let e of this)++t;return t}function nr(){return!this.node()}function rr(t){for(var e=this._groups,n=0,r=e.length;n<r;++n)for(var i=e[n],s=0,a=i.length,o;s<a;++s)(o=i[s])&&t.call(o,o.__data__,s,i);return this}function xa(t){return function(){this.removeAttribute(t)}}function wa(t){return function(){this.removeAttributeNS(t.space,t.local)}}function _a(t,e){return function(){this.setAttribute(t,e)}}function ka(t,e){return function(){this.setAttributeNS(t.space,t.local,e)}}function Sa(t,e){return function(){var n=e.apply(this,arguments);n==null?this.removeAttribute(t):this.setAttribute(t,n)}}function Ca(t,e){return function(){var n=e.apply(this,arguments);n==null?this.removeAttributeNS(t.space,t.local):this.setAttributeNS(t.space,t.local,n)}}function ir(t,e){var n=H(t);if(arguments.length<2){var r=this.node();return n.local?r.getAttributeNS(n.space,n.local):r.getAttribute(n)}return this.each((e==null?n.local?wa:xa:typeof e=="function"?n.local?Ca:Sa:n.local?ka:_a)(n,e))}function Gt(t){return t.ownerDocument&&t.ownerDocument.defaultView||t.document&&t||t.defaultView}function $a(t){return function(){this.style.removeProperty(t)}}function Ea(t,e,n){return function(){this.style.setProperty(t,e,n)}}function Ma(t,e,n){return function(){var r=e.apply(this,arguments);r==null?this.style.removeProperty(t):this.style.setProperty(t,r,n)}}function ar(t,e,n){return arguments.length>1?this.each((e==null?$a:typeof e=="function"?Ma:Ea)(t,e,n??"")):U(this.node(),t)}function U(t,e){return t.style.getPropertyValue(e)||Gt(t).getComputedStyle(t,null).getPropertyValue(e)}function Aa(t){return function(){delete this[t]}}function Ta(t,e){return function(){this[t]=e}}function Ia(t,e){return function(){var n=e.apply(this,arguments);n==null?delete this[t]:this[t]=n}}function sr(t,e){return arguments.length>1?this.each((e==null?Aa:typeof e=="function"?Ia:Ta)(t,e)):this.node()[t]}function or(t){return t.trim().split(/^|\s+/)}function Pe(t){return t.classList||new cr(t)}function cr(t){this._node=t,this._names=or(t.getAttribute("class")||"")}cr.prototype={add:function(t){var e=this._names.indexOf(t);e<0&&(this._names.push(t),this._node.setAttribute("class",this._names.join(" ")))},remove:function(t){var e=this._names.indexOf(t);e>=0&&(this._names.splice(e,1),this._node.setAttribute("class",this._names.join(" ")))},contains:function(t){return this._names.indexOf(t)>=0}};function lr(t,e){for(var n=Pe(t),r=-1,i=e.length;++r<i;)n.add(e[r])}function ur(t,e){for(var n=Pe(t),r=-1,i=e.length;++r<i;)n.remove(e[r])}function Va(t){return function(){lr(this,t)}}function Da(t){return function(){ur(this,t)}}function La(t,e){return function(){(e.apply(this,arguments)?lr:ur)(this,t)}}function dr(t,e){var n=or(t+"");if(arguments.length<2){for(var r=Pe(this.node()),i=-1,s=n.length;++i<s;)if(!r.contains(n[i]))return!1;return!0}return this.each((typeof e=="function"?La:e?Va:Da)(n,e))}function Oa(){this.textContent=""}function Ra(t){return function(){this.textContent=t}}function Na(t){return function(){var e=t.apply(this,arguments);this.textContent=e??""}}function fr(t){return arguments.length?this.each(t==null?Oa:(typeof t=="function"?Na:Ra)(t)):this.node().textContent}function Pa(){this.innerHTML=""}function Ba(t){return function(){this.innerHTML=t}}function Ha(t){return function(){var e=t.apply(this,arguments);this.innerHTML=e??""}}function pr(t){return arguments.length?this.each(t==null?Pa:(typeof t=="function"?Ha:Ba)(t)):this.node().innerHTML}function za(){this.nextSibling&&this.parentNode.appendChild(this)}function hr(){return this.each(za)}function Fa(){this.previousSibling&&this.parentNode.insertBefore(this,this.parentNode.firstChild)}function mr(){return this.each(Fa)}function gr(t){var e=typeof t=="function"?t:Ut(t);return this.select(function(){return this.appendChild(e.apply(this,arguments))})}function qa(){return null}function vr(t,e){var n=typeof t=="function"?t:Ut(t),r=e==null?qa:typeof e=="function"?e:Q(e);return this.select(function(){return this.insertBefore(n.apply(this,arguments),r.apply(this,arguments)||null)})}function Ua(){var t=this.parentNode;t&&t.removeChild(this)}function yr(){return this.each(Ua)}function Xa(){var t=this.cloneNode(!1),e=this.parentNode;return e?e.insertBefore(t,this.nextSibling):t}function Ya(){var t=this.cloneNode(!0),e=this.parentNode;return e?e.insertBefore(t,this.nextSibling):t}function br(t){return this.select(t?Ya:Xa)}function xr(t){return arguments.length?this.property("__data__",t):this.node().__data__}function Ga(t){return function(e){t.call(this,e,this.__data__)}}function Wa(t){return t.trim().split(/^|\s+/).map(function(e){var n="",r=e.indexOf(".");return r>=0&&(n=e.slice(r+1),e=e.slice(0,r)),{type:e,name:n}})}function ja(t){return function(){var e=this.__on;if(e){for(var n=0,r=-1,i=e.length,s;n<i;++n)s=e[n],(!t.type||s.type===t.type)&&s.name===t.name?this.removeEventListener(s.type,s.listener,s.options):e[++r]=s;++r?e.length=r:delete this.__on}}}function Ka(t,e,n){return function(){var r=this.__on,i,s=Ga(e);if(r){for(var a=0,o=r.length;a<o;++a)if((i=r[a]).type===t.type&&i.name===t.name){this.removeEventListener(i.type,i.listener,i.options),this.addEventListener(i.type,i.listener=s,i.options=n),i.value=e;return}}this.addEventListener(t.type,s,n),i={type:t.type,name:t.name,value:e,listener:s,options:n},r?r.push(i):this.__on=[i]}}function wr(t,e,n){var r=Wa(t+""),i,s=r.length,a;if(arguments.length<2){var o=this.node().__on;if(o){for(var l=0,c=o.length,u;l<c;++l)for(i=0,u=o[l];i<s;++i)if((a=r[i]).type===u.type&&a.name===u.name)return u.value}return}for(o=e?Ka:ja,i=0;i<s;++i)this.each(o(r[i],e,n));return this}function _r(t,e,n){var r=Gt(t),i=r.CustomEvent;typeof i=="function"?i=new i(e,n):(i=r.document.createEvent("Event"),n?(i.initEvent(e,n.bubbles,n.cancelable),i.detail=n.detail):i.initEvent(e,!1,!1)),t.dispatchEvent(i)}function Qa(t,e){return function(){return _r(this,t,e)}}function Za(t,e){return function(){return _r(this,t,e.apply(this,arguments))}}function kr(t,e){return this.each((typeof e=="function"?Za:Qa)(t,e))}function*Sr(){for(var t=this._groups,e=0,n=t.length;e<n;++e)for(var r=t[e],i=0,s=r.length,a;i<s;++i)(a=r[i])&&(yield a)}var Be=[null];function x(t,e){this._groups=t,this._parents=e}function Cr(){return new x([[document.documentElement]],Be)}function Ja(){return this}x.prototype=Cr.prototype={constructor:x,select:Bn,selectAll:Hn,selectChild:zn,selectChildren:Fn,filter:qn,data:Yn,enter:Un,exit:Gn,join:Wn,merge:jn,selection:Ja,order:Kn,sort:Qn,call:Zn,nodes:Jn,node:tr,size:er,empty:nr,each:rr,attr:ir,style:ar,property:sr,classed:dr,text:fr,html:pr,raise:hr,lower:mr,append:gr,insert:vr,remove:yr,clone:br,datum:xr,on:wr,dispatch:kr,[Symbol.iterator]:Sr};var z=Cr;function He(t){return typeof t=="string"?new x([[document.querySelector(t)]],[document.documentElement]):new x([[t]],Be)}function Wt(t,e,n){t.prototype=e.prototype=n,n.constructor=t}function ze(t,e){var n=Object.create(t.prototype);for(var r in e)n[r]=e[r];return n}function xt(){}var yt=.7,Qt=1/yt,ot="\\s*([+-]?\\d+)\\s*",bt="\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",N="\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",ts=/^#([0-9a-f]{3,8})$/,es=new RegExp(`^rgb\\(${ot},${ot},${ot}\\)$`),ns=new RegExp(`^rgb\\(${N},${N},${N}\\)$`),rs=new RegExp(`^rgba\\(${ot},${ot},${ot},${bt}\\)$`),is=new RegExp(`^rgba\\(${N},${N},${N},${bt}\\)$`),as=new RegExp(`^hsl\\(${bt},${N},${N}\\)$`),ss=new RegExp(`^hsla\\(${bt},${N},${N},${bt}\\)$`),$r={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074};Wt(xt,R,{copy(t){return Object.assign(new this.constructor,this,t)},displayable(){return this.rgb().displayable()},hex:Er,formatHex:Er,formatHex8:os,formatHsl:cs,formatRgb:Mr,toString:Mr});function Er(){return this.rgb().formatHex()}function os(){return this.rgb().formatHex8()}function cs(){return Lr(this).formatHsl()}function Mr(){return this.rgb().formatRgb()}function R(t){var e,n;return t=(t+"").trim().toLowerCase(),(e=ts.exec(t))?(n=e[1].length,e=parseInt(e[1],16),n===6?Ar(e):n===3?new T(e>>8&15|e>>4&240,e>>4&15|e&240,(e&15)<<4|e&15,1):n===8?jt(e>>24&255,e>>16&255,e>>8&255,(e&255)/255):n===4?jt(e>>12&15|e>>8&240,e>>8&15|e>>4&240,e>>4&15|e&240,((e&15)<<4|e&15)/255):null):(e=es.exec(t))?new T(e[1],e[2],e[3],1):(e=ns.exec(t))?new T(e[1]*255/100,e[2]*255/100,e[3]*255/100,1):(e=rs.exec(t))?jt(e[1],e[2],e[3],e[4]):(e=is.exec(t))?jt(e[1]*255/100,e[2]*255/100,e[3]*255/100,e[4]):(e=as.exec(t))?Vr(e[1],e[2]/100,e[3]/100,1):(e=ss.exec(t))?Vr(e[1],e[2]/100,e[3]/100,e[4]):$r.hasOwnProperty(t)?Ar($r[t]):t==="transparent"?new T(NaN,NaN,NaN,0):null}function Ar(t){return new T(t>>16&255,t>>8&255,t&255,1)}function jt(t,e,n,r){return r<=0&&(t=e=n=NaN),new T(t,e,n,r)}function ls(t){return t instanceof xt||(t=R(t)),t?(t=t.rgb(),new T(t.r,t.g,t.b,t.opacity)):new T}function ct(t,e,n,r){return arguments.length===1?ls(t):new T(t,e,n,r??1)}function T(t,e,n,r){this.r=+t,this.g=+e,this.b=+n,this.opacity=+r}Wt(T,ct,ze(xt,{brighter(t){return t=t==null?Qt:Math.pow(Qt,t),new T(this.r*t,this.g*t,this.b*t,this.opacity)},darker(t){return t=t==null?yt:Math.pow(yt,t),new T(this.r*t,this.g*t,this.b*t,this.opacity)},rgb(){return this},clamp(){return new T(J(this.r),J(this.g),J(this.b),Zt(this.opacity))},displayable(){return-.5<=this.r&&this.r<255.5&&-.5<=this.g&&this.g<255.5&&-.5<=this.b&&this.b<255.5&&0<=this.opacity&&this.opacity<=1},hex:Tr,formatHex:Tr,formatHex8:us,formatRgb:Ir,toString:Ir}));function Tr(){return`#${Z(this.r)}${Z(this.g)}${Z(this.b)}`}function us(){return`#${Z(this.r)}${Z(this.g)}${Z(this.b)}${Z((isNaN(this.opacity)?1:this.opacity)*255)}`}function Ir(){let t=Zt(this.opacity);return`${t===1?"rgb(":"rgba("}${J(this.r)}, ${J(this.g)}, ${J(this.b)}${t===1?")":`, ${t})`}`}function Zt(t){return isNaN(t)?1:Math.max(0,Math.min(1,t))}function J(t){return Math.max(0,Math.min(255,Math.round(t)||0))}function Z(t){return t=J(t),(t<16?"0":"")+t.toString(16)}function Vr(t,e,n,r){return r<=0?t=e=n=NaN:n<=0||n>=1?t=e=NaN:e<=0&&(t=NaN),new O(t,e,n,r)}function Lr(t){if(t instanceof O)return new O(t.h,t.s,t.l,t.opacity);if(t instanceof xt||(t=R(t)),!t)return new O;if(t instanceof O)return t;t=t.rgb();var e=t.r/255,n=t.g/255,r=t.b/255,i=Math.min(e,n,r),s=Math.max(e,n,r),a=NaN,o=s-i,l=(s+i)/2;return o?(e===s?a=(n-r)/o+(n<r)*6:n===s?a=(r-e)/o+2:a=(e-n)/o+4,o/=l<.5?s+i:2-s-i,a*=60):o=l>0&&l<1?0:a,new O(a,o,l,t.opacity)}function Or(t,e,n,r){return arguments.length===1?Lr(t):new O(t,e,n,r??1)}function O(t,e,n,r){this.h=+t,this.s=+e,this.l=+n,this.opacity=+r}Wt(O,Or,ze(xt,{brighter(t){return t=t==null?Qt:Math.pow(Qt,t),new O(this.h,this.s,this.l*t,this.opacity)},darker(t){return t=t==null?yt:Math.pow(yt,t),new O(this.h,this.s,this.l*t,this.opacity)},rgb(){var t=this.h%360+(this.h<0)*360,e=isNaN(t)||isNaN(this.s)?0:this.s,n=this.l,r=n+(n<.5?n:1-n)*e,i=2*n-r;return new T(Fe(t>=240?t-240:t+120,i,r),Fe(t,i,r),Fe(t<120?t+240:t-120,i,r),this.opacity)},clamp(){return new O(Dr(this.h),Kt(this.s),Kt(this.l),Zt(this.opacity))},displayable(){return(0<=this.s&&this.s<=1||isNaN(this.s))&&0<=this.l&&this.l<=1&&0<=this.opacity&&this.opacity<=1},formatHsl(){let t=Zt(this.opacity);return`${t===1?"hsl(":"hsla("}${Dr(this.h)}, ${Kt(this.s)*100}%, ${Kt(this.l)*100}%${t===1?")":`, ${t})`}`}}));function Dr(t){return t=(t||0)%360,t<0?t+360:t}function Kt(t){return Math.max(0,Math.min(1,t||0))}function Fe(t,e,n){return(t<60?e+(n-e)*t/60:t<180?n:t<240?e+(n-e)*(240-t)/60:e)*255}function qe(t,e,n,r,i){var s=t*t,a=s*t;return((1-3*t+3*s-a)*e+(4-6*s+3*a)*n+(1+3*t+3*s-3*a)*r+a*i)/6}function Rr(t){var e=t.length-1;return function(n){var r=n<=0?n=0:n>=1?(n=1,e-1):Math.floor(n*e),i=t[r],s=t[r+1],a=r>0?t[r-1]:2*i-s,o=r<e-1?t[r+2]:2*s-i;return qe((n-r/e)*e,a,i,s,o)}}function Nr(t){var e=t.length;return function(n){var r=Math.floor(((n%=1)<0?++n:n)*e),i=t[(r+e-1)%e],s=t[r%e],a=t[(r+1)%e],o=t[(r+2)%e];return qe((n-r/e)*e,i,s,a,o)}}var wt=t=>()=>t;function ds(t,e){return function(n){return t+n*e}}function fs(t,e,n){return t=Math.pow(t,n),e=Math.pow(e,n)-t,n=1/n,function(r){return Math.pow(t+r*e,n)}}function Pr(t){return(t=+t)==1?Jt:function(e,n){return n-e?fs(e,n,t):wt(isNaN(e)?n:e)}}function Jt(t,e){var n=e-t;return n?ds(t,n):wt(isNaN(t)?e:t)}var tt=function t(e){var n=Pr(e);function r(i,s){var a=n((i=ct(i)).r,(s=ct(s)).r),o=n(i.g,s.g),l=n(i.b,s.b),c=Jt(i.opacity,s.opacity);return function(u){return i.r=a(u),i.g=o(u),i.b=l(u),i.opacity=c(u),i+""}}return r.gamma=t,r}(1);function Br(t){return function(e){var n=e.length,r=new Array(n),i=new Array(n),s=new Array(n),a,o;for(a=0;a<n;++a)o=ct(e[a]),r[a]=o.r||0,i[a]=o.g||0,s[a]=o.b||0;return r=t(r),i=t(i),s=t(s),o.opacity=1,function(l){return o.r=r(l),o.g=i(l),o.b=s(l),o+""}}}var ps=Br(Rr),hs=Br(Nr);function Hr(t,e){e||(e=[]);var n=t?Math.min(e.length,t.length):0,r=e.slice(),i;return function(s){for(i=0;i<n;++i)r[i]=t[i]*(1-s)+e[i]*s;return r}}function zr(t){return ArrayBuffer.isView(t)&&!(t instanceof DataView)}function Fr(t,e){var n=e?e.length:0,r=t?Math.min(n,t.length):0,i=new Array(r),s=new Array(n),a;for(a=0;a<r;++a)i[a]=et(t[a],e[a]);for(;a<n;++a)s[a]=e[a];return function(o){for(a=0;a<r;++a)s[a]=i[a](o);return s}}function qr(t,e){var n=new Date;return t=+t,e=+e,function(r){return n.setTime(t*(1-r)+e*r),n}}function C(t,e){return t=+t,e=+e,function(n){return t*(1-n)+e*n}}function Ur(t,e){var n={},r={},i;(t===null||typeof t!="object")&&(t={}),(e===null||typeof e!="object")&&(e={});for(i in e)i in t?n[i]=et(t[i],e[i]):r[i]=e[i];return function(s){for(i in n)r[i]=n[i](s);return r}}var Xe=/[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,Ue=new RegExp(Xe.source,"g");function ms(t){return function(){return t}}function gs(t){return function(e){return t(e)+""}}function _t(t,e){var n=Xe.lastIndex=Ue.lastIndex=0,r,i,s,a=-1,o=[],l=[];for(t=t+"",e=e+"";(r=Xe.exec(t))&&(i=Ue.exec(e));)(s=i.index)>n&&(s=e.slice(n,s),o[a]?o[a]+=s:o[++a]=s),(r=r[0])===(i=i[0])?o[a]?o[a]+=i:o[++a]=i:(o[++a]=null,l.push({i:a,x:C(r,i)})),n=Ue.lastIndex;return n<e.length&&(s=e.slice(n),o[a]?o[a]+=s:o[++a]=s),o.length<2?l[0]?gs(l[0].x):ms(e):(e=l.length,function(c){for(var u=0,f;u<e;++u)o[(f=l[u]).i]=f.x(c);return o.join("")})}function et(t,e){var n=typeof e,r;return e==null||n==="boolean"?wt(e):(n==="number"?C:n==="string"?(r=R(e))?(e=r,tt):_t:e instanceof R?tt:e instanceof Date?qr:zr(e)?Hr:Array.isArray(e)?Fr:typeof e.valueOf!="function"&&typeof e.toString!="function"||isNaN(e)?Ur:C)(t,e)}function Ye(t,e){return t=+t,e=+e,function(n){return Math.round(t*(1-n)+e*n)}}var Xr=180/Math.PI,te={translateX:0,translateY:0,rotate:0,skewX:0,scaleX:1,scaleY:1};function Ge(t,e,n,r,i,s){var a,o,l;return(a=Math.sqrt(t*t+e*e))&&(t/=a,e/=a),(l=t*n+e*r)&&(n-=t*l,r-=e*l),(o=Math.sqrt(n*n+r*r))&&(n/=o,r/=o,l/=o),t*r<e*n&&(t=-t,e=-e,l=-l,a=-a),{translateX:i,translateY:s,rotate:Math.atan2(e,t)*Xr,skewX:Math.atan(l)*Xr,scaleX:a,scaleY:o}}var ee;function Yr(t){let e=new(typeof DOMMatrix=="function"?DOMMatrix:WebKitCSSMatrix)(t+"");return e.isIdentity?te:Ge(e.a,e.b,e.c,e.d,e.e,e.f)}function Gr(t){return t==null?te:(ee||(ee=document.createElementNS("http://www.w3.org/2000/svg","g")),ee.setAttribute("transform",t),(t=ee.transform.baseVal.consolidate())?(t=t.matrix,Ge(t.a,t.b,t.c,t.d,t.e,t.f)):te)}function Wr(t,e,n,r){function i(c){return c.length?c.pop()+" ":""}function s(c,u,f,d,p,h){if(c!==f||u!==d){var v=p.push("translate(",null,e,null,n);h.push({i:v-4,x:C(c,f)},{i:v-2,x:C(u,d)})}else(f||d)&&p.push("translate("+f+e+d+n)}function a(c,u,f,d){c!==u?(c-u>180?u+=360:u-c>180&&(c+=360),d.push({i:f.push(i(f)+"rotate(",null,r)-2,x:C(c,u)})):u&&f.push(i(f)+"rotate("+u+r)}function o(c,u,f,d){c!==u?d.push({i:f.push(i(f)+"skewX(",null,r)-2,x:C(c,u)}):u&&f.push(i(f)+"skewX("+u+r)}function l(c,u,f,d,p,h){if(c!==f||u!==d){var v=p.push(i(p)+"scale(",null,",",null,")");h.push({i:v-4,x:C(c,f)},{i:v-2,x:C(u,d)})}else(f!==1||d!==1)&&p.push(i(p)+"scale("+f+","+d+")")}return function(c,u){var f=[],d=[];return c=t(c),u=t(u),s(c.translateX,c.translateY,u.translateX,u.translateY,f,d),a(c.rotate,u.rotate,f,d),o(c.skewX,u.skewX,f,d),l(c.scaleX,c.scaleY,u.scaleX,u.scaleY,f,d),c=u=null,function(p){for(var h=-1,v=d.length,m;++h<v;)f[(m=d[h]).i]=m.x(p);return f.join("")}}}var We=Wr(Yr,"px, ","px)","deg)"),je=Wr(Gr,", ",")",")");var lt=0,St=0,kt=0,Kr=1e3,ne,Ct,re=0,nt=0,ie=0,$t=typeof performance=="object"&&performance.now?performance:Date,Qr=typeof window=="object"&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(t){setTimeout(t,17)};function Mt(){return nt||(Qr(vs),nt=$t.now()+ie)}function vs(){nt=0}function Et(){this._call=this._time=this._next=null}Et.prototype=ae.prototype={constructor:Et,restart:function(t,e,n){if(typeof t!="function")throw new TypeError("callback is not a function");n=(n==null?Mt():+n)+(e==null?0:+e),!this._next&&Ct!==this&&(Ct?Ct._next=this:ne=this,Ct=this),this._call=t,this._time=n,Ke()},stop:function(){this._call&&(this._call=null,this._time=1/0,Ke())}};function ae(t,e,n){var r=new Et;return r.restart(t,e,n),r}function Zr(){Mt(),++lt;for(var t=ne,e;t;)(e=nt-t._time)>=0&&t._call.call(void 0,e),t=t._next;--lt}function jr(){nt=(re=$t.now())+ie,lt=St=0;try{Zr()}finally{lt=0,bs(),nt=0}}function ys(){var t=$t.now(),e=t-re;e>Kr&&(ie-=e,re=t)}function bs(){for(var t,e=ne,n,r=1/0;e;)e._call?(r>e._time&&(r=e._time),t=e,e=e._next):(n=e._next,e._next=null,e=t?t._next=n:ne=n);Ct=t,Ke(r)}function Ke(t){if(!lt){St&&(St=clearTimeout(St));var e=t-nt;e>24?(t<1/0&&(St=setTimeout(jr,t-$t.now()-ie)),kt&&(kt=clearInterval(kt))):(kt||(re=$t.now(),kt=setInterval(ys,Kr)),lt=1,Qr(jr))}}function se(t,e,n){var r=new Et;return e=e==null?0:+e,r.restart(i=>{r.stop(),t(i+e)},e,n),r}var xs=Oe("start","end","cancel","interrupt"),ws=[],ei=0,Jr=1,ce=2,oe=3,ti=4,le=5,At=6;function X(t,e,n,r,i,s){var a=t.__transition;if(!a)t.__transition={};else if(n in a)return;_s(t,n,{name:e,index:r,group:i,on:xs,tween:ws,time:s.time,delay:s.delay,duration:s.duration,ease:s.ease,timer:null,state:ei})}function Tt(t,e){var n=_(t,e);if(n.state>ei)throw new Error("too late; already scheduled");return n}function $(t,e){var n=_(t,e);if(n.state>oe)throw new Error("too late; already running");return n}function _(t,e){var n=t.__transition;if(!n||!(n=n[e]))throw new Error("transition not found");return n}function _s(t,e,n){var r=t.__transition,i;r[e]=n,n.timer=ae(s,0,n.time);function s(c){n.state=Jr,n.timer.restart(a,n.delay,n.time),n.delay<=c&&a(c-n.delay)}function a(c){var u,f,d,p;if(n.state!==Jr)return l();for(u in r)if(p=r[u],p.name===n.name){if(p.state===oe)return se(a);p.state===ti?(p.state=At,p.timer.stop(),p.on.call("interrupt",t,t.__data__,p.index,p.group),delete r[u]):+u<e&&(p.state=At,p.timer.stop(),p.on.call("cancel",t,t.__data__,p.index,p.group),delete r[u])}if(se(function(){n.state===oe&&(n.state=ti,n.timer.restart(o,n.delay,n.time),o(c))}),n.state=ce,n.on.call("start",t,t.__data__,n.index,n.group),n.state===ce){for(n.state=oe,i=new Array(d=n.tween.length),u=0,f=-1;u<d;++u)(p=n.tween[u].value.call(t,t.__data__,n.index,n.group))&&(i[++f]=p);i.length=f+1}}function o(c){for(var u=c<n.duration?n.ease.call(null,c/n.duration):(n.timer.restart(l),n.state=le,1),f=-1,d=i.length;++f<d;)i[f].call(t,u);n.state===le&&(n.on.call("end",t,t.__data__,n.index,n.group),l())}function l(){n.state=At,n.timer.stop(),delete r[e];for(var c in r)return;delete t.__transition}}function ue(t,e){var n=t.__transition,r,i,s=!0,a;if(n){e=e==null?null:e+"";for(a in n){if((r=n[a]).name!==e){s=!1;continue}i=r.state>ce&&r.state<le,r.state=At,r.timer.stop(),r.on.call(i?"interrupt":"cancel",t,t.__data__,r.index,r.group),delete n[a]}s&&delete t.__transition}}function ni(t){return this.each(function(){ue(this,t)})}function ks(t,e){var n,r;return function(){var i=$(this,t),s=i.tween;if(s!==n){r=n=s;for(var a=0,o=r.length;a<o;++a)if(r[a].name===e){r=r.slice(),r.splice(a,1);break}}i.tween=r}}function Ss(t,e,n){var r,i;if(typeof n!="function")throw new Error;return function(){var s=$(this,t),a=s.tween;if(a!==r){i=(r=a).slice();for(var o={name:e,value:n},l=0,c=i.length;l<c;++l)if(i[l].name===e){i[l]=o;break}l===c&&i.push(o)}s.tween=i}}function ri(t,e){var n=this._id;if(t+="",arguments.length<2){for(var r=_(this.node(),n).tween,i=0,s=r.length,a;i<s;++i)if((a=r[i]).name===t)return a.value;return null}return this.each((e==null?ks:Ss)(n,t,e))}function ut(t,e,n){var r=t._id;return t.each(function(){var i=$(this,r);(i.value||(i.value={}))[e]=n.apply(this,arguments)}),function(i){return _(i,r).value[e]}}function de(t,e){var n;return(typeof e=="number"?C:e instanceof R?tt:(n=R(e))?(e=n,tt):_t)(t,e)}function Cs(t){return function(){this.removeAttribute(t)}}function $s(t){return function(){this.removeAttributeNS(t.space,t.local)}}function Es(t,e,n){var r,i=n+"",s;return function(){var a=this.getAttribute(t);return a===i?null:a===r?s:s=e(r=a,n)}}function Ms(t,e,n){var r,i=n+"",s;return function(){var a=this.getAttributeNS(t.space,t.local);return a===i?null:a===r?s:s=e(r=a,n)}}function As(t,e,n){var r,i,s;return function(){var a,o=n(this),l;return o==null?void this.removeAttribute(t):(a=this.getAttribute(t),l=o+"",a===l?null:a===r&&l===i?s:(i=l,s=e(r=a,o)))}}function Ts(t,e,n){var r,i,s;return function(){var a,o=n(this),l;return o==null?void this.removeAttributeNS(t.space,t.local):(a=this.getAttributeNS(t.space,t.local),l=o+"",a===l?null:a===r&&l===i?s:(i=l,s=e(r=a,o)))}}function ii(t,e){var n=H(t),r=n==="transform"?je:de;return this.attrTween(t,typeof e=="function"?(n.local?Ts:As)(n,r,ut(this,"attr."+t,e)):e==null?(n.local?$s:Cs)(n):(n.local?Ms:Es)(n,r,e))}function Is(t,e){return function(n){this.setAttribute(t,e.call(this,n))}}function Vs(t,e){return function(n){this.setAttributeNS(t.space,t.local,e.call(this,n))}}function Ds(t,e){var n,r;function i(){var s=e.apply(this,arguments);return s!==r&&(n=(r=s)&&Vs(t,s)),n}return i._value=e,i}function Ls(t,e){var n,r;function i(){var s=e.apply(this,arguments);return s!==r&&(n=(r=s)&&Is(t,s)),n}return i._value=e,i}function ai(t,e){var n="attr."+t;if(arguments.length<2)return(n=this.tween(n))&&n._value;if(e==null)return this.tween(n,null);if(typeof e!="function")throw new Error;var r=H(t);return this.tween(n,(r.local?Ds:Ls)(r,e))}function Os(t,e){return function(){Tt(this,t).delay=+e.apply(this,arguments)}}function Rs(t,e){return e=+e,function(){Tt(this,t).delay=e}}function si(t){var e=this._id;return arguments.length?this.each((typeof t=="function"?Os:Rs)(e,t)):_(this.node(),e).delay}function Ns(t,e){return function(){$(this,t).duration=+e.apply(this,arguments)}}function Ps(t,e){return e=+e,function(){$(this,t).duration=e}}function oi(t){var e=this._id;return arguments.length?this.each((typeof t=="function"?Ns:Ps)(e,t)):_(this.node(),e).duration}function Bs(t,e){if(typeof e!="function")throw new Error;return function(){$(this,t).ease=e}}function ci(t){var e=this._id;return arguments.length?this.each(Bs(e,t)):_(this.node(),e).ease}function Hs(t,e){return function(){var n=e.apply(this,arguments);if(typeof n!="function")throw new Error;$(this,t).ease=n}}function li(t){if(typeof t!="function")throw new Error;return this.each(Hs(this._id,t))}function ui(t){typeof t!="function"&&(t=gt(t));for(var e=this._groups,n=e.length,r=new Array(n),i=0;i<n;++i)for(var s=e[i],a=s.length,o=r[i]=[],l,c=0;c<a;++c)(l=s[c])&&t.call(l,l.__data__,c,s)&&o.push(l);return new M(r,this._parents,this._name,this._id)}function di(t){if(t._id!==this._id)throw new Error;for(var e=this._groups,n=t._groups,r=e.length,i=n.length,s=Math.min(r,i),a=new Array(r),o=0;o<s;++o)for(var l=e[o],c=n[o],u=l.length,f=a[o]=new Array(u),d,p=0;p<u;++p)(d=l[p]||c[p])&&(f[p]=d);for(;o<r;++o)a[o]=e[o];return new M(a,this._parents,this._name,this._id)}function zs(t){return(t+"").trim().split(/^|\s+/).every(function(e){var n=e.indexOf(".");return n>=0&&(e=e.slice(0,n)),!e||e==="start"})}function Fs(t,e,n){var r,i,s=zs(e)?Tt:$;return function(){var a=s(this,t),o=a.on;o!==r&&(i=(r=o).copy()).on(e,n),a.on=i}}function fi(t,e){var n=this._id;return arguments.length<2?_(this.node(),n).on.on(t):this.each(Fs(n,t,e))}function qs(t){return function(){var e=this.parentNode;for(var n in this.__transition)if(+n!==t)return;e&&e.removeChild(this)}}function pi(){return this.on("end.remove",qs(this._id))}function hi(t){var e=this._name,n=this._id;typeof t!="function"&&(t=Q(t));for(var r=this._groups,i=r.length,s=new Array(i),a=0;a<i;++a)for(var o=r[a],l=o.length,c=s[a]=new Array(l),u,f,d=0;d<l;++d)(u=o[d])&&(f=t.call(u,u.__data__,d,o))&&("__data__"in u&&(f.__data__=u.__data__),c[d]=f,X(c[d],e,n,d,c,_(u,n)));return new M(s,this._parents,e,n)}function mi(t){var e=this._name,n=this._id;typeof t!="function"&&(t=mt(t));for(var r=this._groups,i=r.length,s=[],a=[],o=0;o<i;++o)for(var l=r[o],c=l.length,u,f=0;f<c;++f)if(u=l[f]){for(var d=t.call(u,u.__data__,f,l),p,h=_(u,n),v=0,m=d.length;v<m;++v)(p=d[v])&&X(p,e,n,v,d,h);s.push(d),a.push(u)}return new M(s,a,e,n)}var Us=z.prototype.constructor;function gi(){return new Us(this._groups,this._parents)}function Xs(t,e){var n,r,i;return function(){var s=U(this,t),a=(this.style.removeProperty(t),U(this,t));return s===a?null:s===n&&a===r?i:i=e(n=s,r=a)}}function vi(t){return function(){this.style.removeProperty(t)}}function Ys(t,e,n){var r,i=n+"",s;return function(){var a=U(this,t);return a===i?null:a===r?s:s=e(r=a,n)}}function Gs(t,e,n){var r,i,s;return function(){var a=U(this,t),o=n(this),l=o+"";return o==null&&(l=o=(this.style.removeProperty(t),U(this,t))),a===l?null:a===r&&l===i?s:(i=l,s=e(r=a,o))}}function Ws(t,e){var n,r,i,s="style."+e,a="end."+s,o;return function(){var l=$(this,t),c=l.on,u=l.value[s]==null?o||(o=vi(e)):void 0;(c!==n||i!==u)&&(r=(n=c).copy()).on(a,i=u),l.on=r}}function yi(t,e,n){var r=(t+="")=="transform"?We:de;return e==null?this.styleTween(t,Xs(t,r)).on("end.style."+t,vi(t)):typeof e=="function"?this.styleTween(t,Gs(t,r,ut(this,"style."+t,e))).each(Ws(this._id,t)):this.styleTween(t,Ys(t,r,e),n).on("end.style."+t,null)}function js(t,e,n){return function(r){this.style.setProperty(t,e.call(this,r),n)}}function Ks(t,e,n){var r,i;function s(){var a=e.apply(this,arguments);return a!==i&&(r=(i=a)&&js(t,a,n)),r}return s._value=e,s}function bi(t,e,n){var r="style."+(t+="");if(arguments.length<2)return(r=this.tween(r))&&r._value;if(e==null)return this.tween(r,null);if(typeof e!="function")throw new Error;return this.tween(r,Ks(t,e,n??""))}function Qs(t){return function(){this.textContent=t}}function Zs(t){return function(){var e=t(this);this.textContent=e??""}}function xi(t){return this.tween("text",typeof t=="function"?Zs(ut(this,"text",t)):Qs(t==null?"":t+""))}function Js(t){return function(e){this.textContent=t.call(this,e)}}function to(t){var e,n;function r(){var i=t.apply(this,arguments);return i!==n&&(e=(n=i)&&Js(i)),e}return r._value=t,r}function wi(t){var e="text";if(arguments.length<1)return(e=this.tween(e))&&e._value;if(t==null)return this.tween(e,null);if(typeof t!="function")throw new Error;return this.tween(e,to(t))}function _i(){for(var t=this._name,e=this._id,n=fe(),r=this._groups,i=r.length,s=0;s<i;++s)for(var a=r[s],o=a.length,l,c=0;c<o;++c)if(l=a[c]){var u=_(l,e);X(l,t,n,c,a,{time:u.time+u.delay+u.duration,delay:0,duration:u.duration,ease:u.ease})}return new M(r,this._parents,t,n)}function ki(){var t,e,n=this,r=n._id,i=n.size();return new Promise(function(s,a){var o={value:a},l={value:function(){--i===0&&s()}};n.each(function(){var c=$(this,r),u=c.on;u!==t&&(e=(t=u).copy(),e._.cancel.push(o),e._.interrupt.push(o),e._.end.push(l)),c.on=e}),i===0&&s()})}var eo=0;function M(t,e,n,r){this._groups=t,this._parents=e,this._name=n,this._id=r}function Si(t){return z().transition(t)}function fe(){return++eo}var F=z.prototype;M.prototype=Si.prototype={constructor:M,select:hi,selectAll:mi,selectChild:F.selectChild,selectChildren:F.selectChildren,filter:ui,merge:di,selection:gi,transition:_i,call:F.call,nodes:F.nodes,node:F.node,size:F.size,empty:F.empty,each:F.each,on:fi,attr:ii,attrTween:ai,style:yi,styleTween:bi,text:xi,textTween:wi,remove:pi,tween:ri,delay:si,duration:oi,ease:ci,easeVarying:li,end:ki,[Symbol.iterator]:F[Symbol.iterator]};function pe(t){return((t*=2)<=1?t*t*t:(t-=2)*t*t+2)/2}var no={time:null,delay:0,duration:250,ease:pe};function ro(t,e){for(var n;!(n=t.__transition)||!(n=n[e]);)if(!(t=t.parentNode))throw new Error(`transition ${e} not found`);return n}function Ci(t){var e,n;t instanceof M?(e=t._id,t=t._name):(e=fe(),(n=no).time=Mt(),t=t==null?null:t+"");for(var r=this._groups,i=r.length,s=0;s<i;++s)for(var a=r[s],o=a.length,l,c=0;c<o;++c)(l=a[c])&&X(l,t,e,c,a,n||ro(l,e));return new M(r,this._parents,t,e)}z.prototype.interrupt=ni;z.prototype.transition=Ci;var{abs:sp,max:op,min:cp}=Math;function $i(t){return[+t[0],+t[1]]}function io(t){return[$i(t[0]),$i(t[1])]}var lp={name:"x",handles:["w","e"].map(Qe),input:function(t,e){return t==null?null:[[+t[0],e[0][1]],[+t[1],e[1][1]]]},output:function(t){return t&&[t[0][0],t[1][0]]}},up={name:"y",handles:["n","s"].map(Qe),input:function(t,e){return t==null?null:[[e[0][0],+t[0]],[e[1][0],+t[1]]]},output:function(t){return t&&[t[0][1],t[1][1]]}},dp={name:"xy",handles:["n","w","e","s","nw","ne","sw","se"].map(Qe),input:function(t){return t==null?null:io(t)},output:function(t){return t}};function Qe(t){return{type:t}}function Ei(t){return Math.abs(t=Math.round(t))>=1e21?t.toLocaleString("en").replace(/,/g,""):t.toString(10)}function rt(t,e){if(!isFinite(t)||t===0)return null;var n=(t=e?t.toExponential(e-1):t.toExponential()).indexOf("e"),r=t.slice(0,n);return[r.length>1?r[0]+r.slice(2):r,+t.slice(n+1)]}function P(t){return t=rt(Math.abs(t)),t?t[1]:NaN}function Mi(t,e){return function(n,r){for(var i=n.length,s=[],a=0,o=t[0],l=0;i>0&&o>0&&(l+o+1>r&&(o=Math.max(1,r-l)),s.push(n.substring(i-=o,i+o)),!((l+=o+1)>r));)o=t[a=(a+1)%t.length];return s.reverse().join(e)}}function Ai(t){return function(e){return e.replace(/[0-9]/g,function(n){return t[+n]})}}var ao=/^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;function Y(t){if(!(e=ao.exec(t)))throw new Error("invalid format: "+t);var e;return new he({fill:e[1],align:e[2],sign:e[3],symbol:e[4],zero:e[5],width:e[6],comma:e[7],precision:e[8]&&e[8].slice(1),trim:e[9],type:e[10]})}Y.prototype=he.prototype;function he(t){this.fill=t.fill===void 0?" ":t.fill+"",this.align=t.align===void 0?">":t.align+"",this.sign=t.sign===void 0?"-":t.sign+"",this.symbol=t.symbol===void 0?"":t.symbol+"",this.zero=!!t.zero,this.width=t.width===void 0?void 0:+t.width,this.comma=!!t.comma,this.precision=t.precision===void 0?void 0:+t.precision,this.trim=!!t.trim,this.type=t.type===void 0?"":t.type+""}he.prototype.toString=function(){return this.fill+this.align+this.sign+this.symbol+(this.zero?"0":"")+(this.width===void 0?"":Math.max(1,this.width|0))+(this.comma?",":"")+(this.precision===void 0?"":"."+Math.max(0,this.precision|0))+(this.trim?"~":"")+this.type};function Ti(t){t:for(var e=t.length,n=1,r=-1,i;n<e;++n)switch(t[n]){case".":r=i=n;break;case"0":r===0&&(r=n),i=n;break;default:if(!+t[n])break t;r>0&&(r=0);break}return r>0?t.slice(0,r)+t.slice(i+1):t}var It;function Ii(t,e){var n=rt(t,e);if(!n)return It=void 0,t.toPrecision(e);var r=n[0],i=n[1],s=i-(It=Math.max(-8,Math.min(8,Math.floor(i/3)))*3)+1,a=r.length;return s===a?r:s>a?r+new Array(s-a+1).join("0"):s>0?r.slice(0,s)+"."+r.slice(s):"0."+new Array(1-s).join("0")+rt(t,Math.max(0,e+s-1))[0]}function Ze(t,e){var n=rt(t,e);if(!n)return t+"";var r=n[0],i=n[1];return i<0?"0."+new Array(-i).join("0")+r:r.length>i+1?r.slice(0,i+1)+"."+r.slice(i+1):r+new Array(i-r.length+2).join("0")}var Je={"%":(t,e)=>(t*100).toFixed(e),b:t=>Math.round(t).toString(2),c:t=>t+"",d:Ei,e:(t,e)=>t.toExponential(e),f:(t,e)=>t.toFixed(e),g:(t,e)=>t.toPrecision(e),o:t=>Math.round(t).toString(8),p:(t,e)=>Ze(t*100,e),r:Ze,s:Ii,X:t=>Math.round(t).toString(16).toUpperCase(),x:t=>Math.round(t).toString(16)};function tn(t){return t}var Vi=Array.prototype.map,Di=["y","z","a","f","p","n","\xB5","m","","k","M","G","T","P","E","Z","Y"];function Li(t){var e=t.grouping===void 0||t.thousands===void 0?tn:Mi(Vi.call(t.grouping,Number),t.thousands+""),n=t.currency===void 0?"":t.currency[0]+"",r=t.currency===void 0?"":t.currency[1]+"",i=t.decimal===void 0?".":t.decimal+"",s=t.numerals===void 0?tn:Ai(Vi.call(t.numerals,String)),a=t.percent===void 0?"%":t.percent+"",o=t.minus===void 0?"\u2212":t.minus+"",l=t.nan===void 0?"NaN":t.nan+"";function c(f,d){f=Y(f);var p=f.fill,h=f.align,v=f.sign,m=f.symbol,y=f.zero,k=f.width,S=f.comma,w=f.precision,E=f.trim,b=f.type;b==="n"?(S=!0,b="g"):Je[b]||(w===void 0&&(w=12),E=!0,b="g"),(y||p==="0"&&h==="=")&&(y=!0,p="0",h="=");var A=(d&&d.prefix!==void 0?d.prefix:"")+(m==="$"?n:m==="#"&&/[boxX]/.test(b)?"0"+b.toLowerCase():""),it=(m==="$"?r:/[%p]/.test(b)?a:"")+(d&&d.suffix!==void 0?d.suffix:""),W=Je[b],j=/[defgprs%]/.test(b);w=w===void 0?6:/[gprs]/.test(b)?Math.max(1,Math.min(21,w)):Math.max(0,Math.min(20,w));function q(g){var I=A,V=it,at,hn,Lt;if(b==="c")V=W(g)+V,g="";else{g=+g;var Ot=g<0||1/g<0;if(g=isNaN(g)?l:W(Math.abs(g),w),E&&(g=Ti(g)),Ot&&+g==0&&v!=="+"&&(Ot=!1),I=(Ot?v==="("?v:o:v==="-"||v==="("?"":v)+I,V=(b==="s"&&!isNaN(g)&&It!==void 0?Di[8+It/3]:"")+V+(Ot&&v==="("?")":""),j){for(at=-1,hn=g.length;++at<hn;)if(Lt=g.charCodeAt(at),48>Lt||Lt>57){V=(Lt===46?i+g.slice(at+1):g.slice(at))+V,g=g.slice(0,at);break}}}S&&!y&&(g=e(g,1/0));var Rt=I.length+g.length+V.length,B=Rt<k?new Array(k-Rt+1).join(p):"";switch(S&&y&&(g=e(B+g,B.length?k-V.length:1/0),B=""),h){case"<":g=I+g+V+B;break;case"=":g=I+B+g+V;break;case"^":g=B.slice(0,Rt=B.length>>1)+I+g+V+B.slice(Rt);break;default:g=B+I+g+V;break}return s(g)}return q.toString=function(){return f+""},q}function u(f,d){var p=Math.max(-8,Math.min(8,Math.floor(P(d)/3)))*3,h=Math.pow(10,-p),v=c((f=Y(f),f.type="f",f),{suffix:Di[8+p/3]});return function(m){return v(h*m)}}return{format:c,formatPrefix:u}}var me,ge,ve;en({thousands:",",grouping:[3],currency:["$",""]});function en(t){return me=Li(t),ge=me.format,ve=me.formatPrefix,me}function nn(t){return Math.max(0,-P(Math.abs(t)))}function rn(t,e){return Math.max(0,Math.max(-8,Math.min(8,Math.floor(P(e)/3)))*3-P(Math.abs(t)))}function an(t,e){return t=Math.abs(t),e=Math.abs(e)-t,Math.max(0,P(e)-P(t))+1}function dt(t,e){switch(arguments.length){case 0:break;case 1:this.range(t);break;default:this.range(e).domain(t);break}return this}var Oi=Symbol("implicit");function ye(){var t=new st,e=[],n=[],r=Oi;function i(s){let a=t.get(s);if(a===void 0){if(r!==Oi)return r;t.set(s,a=e.push(s)-1)}return n[a%n.length]}return i.domain=function(s){if(!arguments.length)return e.slice();e=[],t=new st;for(let a of s)t.has(a)||t.set(a,e.push(a)-1);return i},i.range=function(s){return arguments.length?(n=Array.from(s),i):n.slice()},i.unknown=function(s){return arguments.length?(r=s,i):r},i.copy=function(){return ye(e,n).unknown(r)},dt.apply(i,arguments),i}function Vt(){var t=ye().unknown(void 0),e=t.domain,n=t.range,r=0,i=1,s,a,o=!1,l=0,c=0,u=.5;delete t.unknown;function f(){var d=e().length,p=i<r,h=p?i:r,v=p?r:i;s=(v-h)/Math.max(1,d-l+c*2),o&&(s=Math.floor(s)),h+=(v-h-s*(d-l))*u,a=s*(1-l),o&&(h=Math.round(h),a=Math.round(a));var m=zt(d).map(function(y){return h+s*y});return n(p?m.reverse():m)}return t.domain=function(d){return arguments.length?(e(d),f()):e()},t.range=function(d){return arguments.length?([r,i]=d,r=+r,i=+i,f()):[r,i]},t.rangeRound=function(d){return[r,i]=d,r=+r,i=+i,o=!0,f()},t.bandwidth=function(){return a},t.step=function(){return s},t.round=function(d){return arguments.length?(o=!!d,f()):o},t.padding=function(d){return arguments.length?(l=Math.min(1,c=+d),f()):l},t.paddingInner=function(d){return arguments.length?(l=Math.min(1,d),f()):l},t.paddingOuter=function(d){return arguments.length?(c=+d,f()):c},t.align=function(d){return arguments.length?(u=Math.max(0,Math.min(1,d)),f()):u},t.copy=function(){return Vt(e(),[r,i]).round(o).paddingInner(l).paddingOuter(c).align(u)},dt.apply(f(),arguments)}function sn(t){return function(){return t}}function on(t){return+t}var Ri=[0,1];function ft(t){return t}function cn(t,e){return(e-=t=+t)?function(n){return(n-t)/e}:sn(isNaN(e)?NaN:.5)}function so(t,e){var n;return t>e&&(n=t,t=e,e=n),function(r){return Math.max(t,Math.min(e,r))}}function oo(t,e,n){var r=t[0],i=t[1],s=e[0],a=e[1];return i<r?(r=cn(i,r),s=n(a,s)):(r=cn(r,i),s=n(s,a)),function(o){return s(r(o))}}function co(t,e,n){var r=Math.min(t.length,e.length)-1,i=new Array(r),s=new Array(r),a=-1;for(t[r]<t[0]&&(t=t.slice().reverse(),e=e.slice().reverse());++a<r;)i[a]=cn(t[a],t[a+1]),s[a]=n(e[a],e[a+1]);return function(o){var l=Me(t,o,1,r)-1;return s[l](i[l](o))}}function Ni(t,e){return e.domain(t.domain()).range(t.range()).interpolate(t.interpolate()).clamp(t.clamp()).unknown(t.unknown())}function lo(){var t=Ri,e=Ri,n=et,r,i,s,a=ft,o,l,c;function u(){var d=Math.min(t.length,e.length);return a!==ft&&(a=so(t[0],t[d-1])),o=d>2?co:oo,l=c=null,f}function f(d){return d==null||isNaN(d=+d)?s:(l||(l=o(t.map(r),e,n)))(r(a(d)))}return f.invert=function(d){return a(i((c||(c=o(e,t.map(r),C)))(d)))},f.domain=function(d){return arguments.length?(t=Array.from(d,on),u()):t.slice()},f.range=function(d){return arguments.length?(e=Array.from(d),u()):e.slice()},f.rangeRound=function(d){return e=Array.from(d),n=Ye,u()},f.clamp=function(d){return arguments.length?(a=d?!0:ft,u()):a!==ft},f.interpolate=function(d){return arguments.length?(n=d,u()):n},f.unknown=function(d){return arguments.length?(s=d,f):s},function(d,p){return r=d,i=p,u()}}function ln(){return lo()(ft,ft)}function un(t,e,n,r){var i=Ae(t,e,n),s;switch(r=Y(r??",f"),r.type){case"s":{var a=Math.max(Math.abs(t),Math.abs(e));return r.precision==null&&!isNaN(s=rn(i,a))&&(r.precision=s),ve(r,a)}case"":case"e":case"g":case"p":case"r":{r.precision==null&&!isNaN(s=an(i,Math.max(Math.abs(t),Math.abs(e))))&&(r.precision=s-(r.type==="e"));break}case"f":case"%":{r.precision==null&&!isNaN(s=nn(i))&&(r.precision=s-(r.type==="%")*2);break}}return ge(r)}function uo(t){var e=t.domain;return t.ticks=function(n){var r=e();return Bt(r[0],r[r.length-1],n??10)},t.tickFormat=function(n,r){var i=e();return un(i[0],i[i.length-1],n??10,r)},t.nice=function(n){n==null&&(n=10);var r=e(),i=0,s=r.length-1,a=r[i],o=r[s],l,c,u=10;for(o<a&&(c=a,a=o,o=c,c=i,i=s,s=c);u-- >0;){if(c=pt(a,o,n),c===l)return r[i]=a,r[s]=o,e(r);if(c>0)a=Math.floor(a/c)*c,o=Math.ceil(o/c)*c;else if(c<0)a=Math.ceil(a*c)/c,o=Math.floor(o*c)/c;else break;l=c}return t},t}function Dt(){var t=ln();return t.copy=function(){return Ni(t,Dt())},dt.apply(t,arguments),uo(t)}function G(t,e,n){this.k=t,this.x=e,this.y=n}G.prototype={constructor:G,scale:function(t){return t===1?this:new G(this.k*t,this.x,this.y)},translate:function(t,e){return t===0&e===0?this:new G(this.k,this.x+this.k*t,this.y+this.k*e)},apply:function(t){return[t[0]*this.k+this.x,t[1]*this.k+this.y]},applyX:function(t){return t*this.k+this.x},applyY:function(t){return t*this.k+this.y},invert:function(t){return[(t[0]-this.x)/this.k,(t[1]-this.y)/this.k]},invertX:function(t){return(t-this.x)/this.k},invertY:function(t){return(t-this.y)/this.k},rescaleX:function(t){return t.copy().domain(t.range().map(this.invertX,this).map(t.invert,t))},rescaleY:function(t){return t.copy().domain(t.range().map(this.invertY,this).map(t.invert,t))},toString:function(){return"translate("+this.x+","+this.y+") scale("+this.k+")"}};var dn=new G(1,0,0);fn.prototype=G.prototype;function fn(t){for(;!t.__zoom;)if(!(t=t.parentNode))return dn;return t.__zoom}function Pi(t,e){t.innerHTML="";let n=[{key:"applied",label:"Applied",colorVar:"--color-stage-applied"},{key:"screening",label:"Screening",colorVar:"--color-stage-screening"},{key:"interview",label:"Interview",colorVar:"--color-stage-interview"},{key:"offer",label:"Offer",colorVar:"--color-stage-offer"},{key:"hired",label:"Hired",colorVar:"--color-stage-hired"}];if(n.reduce((m,y)=>m+(e[y.key]?.reached||0),0)===0){let m=document.createElement("div");m.className="funnel-empty-state",m.setAttribute("role","region"),m.setAttribute("aria-label","Pipeline Funnel"),m.innerHTML=`
      <div class="empty-state-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
      <div class="empty-state-text">
        <strong>No Candidates in Pipeline</strong>
        <p>This vacancy currently has no active or historical applicants. Adding a candidate will populate the pipeline funnel.</p>
      </div>
      <div class="funnel-empty-grid">
        ${n.map(y=>`
          <div class="funnel-empty-stage">
            <span class="empty-stage-name">${y.label}</span>
            <span class="empty-stage-val">0</span>
          </div>
        `).join("")}
      </div>
    `,t.appendChild(m);return}let i=He(t).append("div").attr("class","funnel-chart-wrapper"),s=Math.min(800,t.clientWidth||800),a=260,o={top:20,right:20,bottom:40,left:30},l=s-o.left-o.right,c=a-o.top-o.bottom,f=i.append("svg").attr("viewBox",`0 0 ${s} ${a}`).attr("preserveAspectRatio","xMidYMid meet").attr("class","funnel-svg").attr("role","img").attr("aria-label","Pipeline stage funnel chart").append("g").attr("transform",`translate(${o.left},${o.top})`),d=Math.max(1,Ht(n,m=>e[m.key]?.reached||0)||1),p=Vt().domain(n.map(m=>m.label)).range([0,l]).padding(.25),h=Dt().domain([0,d]).range([c,0]).nice();f.append("g").attr("class","grid-lines").call(Le(h).ticks(Math.min(5,d)).tickSize(-l).tickFormat(()=>"")).call(m=>m.select(".domain").remove()),n.forEach(m=>{let y=e[m.key]||{reached:0,remain:0,lost:0},k=p(m.label)||0,S=p.bandwidth(),w=c-h(y.reached),E=h(y.reached),b=f.append("g").attr("class",`funnel-bar-group stage-${m.key}`);b.append("rect").attr("class","funnel-bar-reached").attr("x",k).attr("y",E).attr("width",S).attr("height",Math.max(2,w)).attr("rx",4).attr("ry",4),b.append("text").attr("class","funnel-val-label").attr("x",k+S/2).attr("y",Math.max(12,E-6)).attr("text-anchor","middle").text(y.reached);let A=y.reached>0?y.remain/y.reached:0,it=y.reached>0?y.lost/y.reached:0;y.remain>0&&w>20&&b.append("rect").attr("class","funnel-bar-remain").attr("x",k+2).attr("y",E+w-w*A).attr("width",Math.max(0,S-4)).attr("height",Math.max(2,w*A-2)).attr("rx",2)}),f.append("g").attr("class","x-axis").attr("transform",`translate(0,${c})`).call(De(p).tickSize(0)).call(m=>m.select(".domain").remove());let v=i.append("div").attr("class","funnel-metrics-row");n.forEach(m=>{let y=e[m.key]||{reached:0,remain:0,lost:0};v.append("div").attr("class","funnel-stage-card").html(`
        <div class="stage-card-header">
          <span class="stage-dot ${m.key}"></span>
          <span class="stage-card-name">${m.label}</span>
        </div>
        <div class="stage-card-stats">
          <div class="stat-item" title="Unique candidates who reached this stage">
            <span class="stat-num">${y.reached}</span>
            <span class="stat-lbl">Reached</span>
          </div>
          <div class="stat-item" title="Candidates currently active in this stage">
            <span class="stat-num active-val">${y.remain}</span>
            <span class="stat-lbl">Active</span>
          </div>
          <div class="stat-item" title="Candidates who dropped out or were rejected after this stage">
            <span class="stat-num lost-val">${y.lost}</span>
            <span class="stat-lbl">Lost</span>
          </div>
        </div>
      `)})}var be=class{container;vacancies;currentDetails;currentUser;callbacks;activeTab="pipeline";constructor(e,n,r,i,s){this.container=e,this.vacancies=n,this.currentDetails=r,this.currentUser=i,this.callbacks=s,this.render()}update(e,n){this.vacancies=e,this.currentDetails=n,this.render()}render(){if(!this.currentDetails){this.container.innerHTML='<div class="loading-state">Loading vacancy workspace...</div>';return}let e=this.currentDetails.vacancy,n=this.currentDetails.candidates,r=this.currentDetails.activity,i=this.currentUser;this.container.innerHTML=`
      <div class="workspace-layout">
        <!-- Vacancy Selector Tabs -->
        <nav class="vacancy-nav-tabs" aria-label="Vacancies">
          ${this.vacancies.map(a=>`
              <button class="vacancy-tab-btn ${a.code===e.code?"active":""}" data-code="${a.code}">
                <div class="tab-top-row">
                  <span class="tab-role-title">${a.title}</span>
                  <span class="tab-code-badge">${a.code}</span>
                </div>
                <div class="tab-meta-row">
                  <span class="tab-team">${a.team}</span>
                  <span class="tab-cand-count">${a.candidate_count} applicants</span>
                  <span class="tab-avail-badge ${a.available===0?"full":""}">${a.available} open</span>
                </div>
              </button>
            `).join("")}
        </nav>

        <!-- Main Vacancy Area -->
        <main class="vacancy-main-content">
          <!-- Vacancy Header Card -->
          <div class="vacancy-header-card">
            <div class="vacancy-title-section">
              <div class="vacancy-badges">
                <span class="vacancy-code-tag">${e.code}</span>
                <span class="vacancy-team-tag">${e.team} Team</span>
                <span class="vacancy-revision-tag" title="Revision counter for optimistic concurrency">Rev ${e.revision}</span>
              </div>
              <h2 class="vacancy-main-title">${e.title}</h2>
            </div>

            <!-- Capacity Control -->
            <div class="vacancy-capacity-bar-card">
              <div class="cap-header">
                <span class="cap-title"><strong>Openings & Capacity:</strong> ${e.openings} Total</span>
                <span class="cap-status ${e.available>0?"has-openings":"no-openings"}">
                  ${e.available>0?`${e.available} Opening(s) Available`:"All Openings Committed"}
                </span>
              </div>
              <div class="segmented-capacity-bar" role="progressbar" aria-valuenow="${e.reserved+e.filled}" aria-valuemin="0" aria-valuemax="${e.openings}">
                <div class="seg seg-filled" style="width: ${e.filled/Math.max(1,e.openings)*100}%;" title="${e.filled} Hired / Filled"></div>
                <div class="seg seg-reserved" style="width: ${e.reserved/Math.max(1,e.openings)*100}%;" title="${e.reserved} Offer Reserved"></div>
                <div class="seg seg-available" style="width: ${e.available/Math.max(1,e.openings)*100}%;" title="${e.available} Available"></div>
              </div>
              <div class="cap-legend">
                <span class="legend-item"><span class="dot dot-filled"></span> ${e.filled} Filled (Hired)</span>
                <span class="legend-item"><span class="dot dot-reserved"></span> ${e.reserved} Reserved (Offer)</span>
                <span class="legend-item"><span class="dot dot-available"></span> ${e.available} Available</span>
              </div>
            </div>

            <!-- Header Action Buttons -->
            <div class="vacancy-actions-row">
              ${i.role==="coordinator"?`
                <button id="add-candidate-btn" class="btn btn-primary" title="Add new candidate to this vacancy">
                  + Add Candidate
                </button>
              `:""}

              ${i.role==="hiring manager"?`
                <button id="batch-offers-btn" class="btn btn-secondary" title="Review and extend batch offers">
                  \u26A1 Batch Offers
                </button>
              `:""}

              <button id="refresh-vacancy-btn" class="btn btn-outline btn-icon" title="Refresh latest state">
                \u21BB Refresh
              </button>
            </div>
          </div>

          <!-- Funnel Chart Section -->
          <section class="vacancy-section funnel-section">
            <div class="section-header">
              <h3 class="section-title">Pipeline Funnel (D3)</h3>
              <span class="section-sub">Derived directly from candidate stage visit history</span>
            </div>
            <div id="funnel-container" class="funnel-container"></div>
          </section>

          <!-- Workspace View Tabs (Pipeline vs Activity) -->
          <div class="view-switch-tabs">
            <button class="view-tab-btn ${this.activeTab==="pipeline"?"active":""}" id="tab-pipeline-btn">
              Candidates Pipeline (${n.length})
            </button>
            <button class="view-tab-btn ${this.activeTab==="activity"?"active":""}" id="tab-activity-btn">
              Vacancy Activity Trail (${r.length})
            </button>
          </div>

          <!-- Tab 1: Candidates Pipeline Board -->
          ${this.activeTab==="pipeline"?`
            <div class="pipeline-board">
              ${this.renderPipelineBoard(n)}
            </div>
          `:`
            <!-- Tab 2: Activity Trail -->
            <div class="activity-trail-view">
              ${this.renderActivityTrail(r)}
            </div>
          `}
        </main>
      </div>
    `;let s=this.container.querySelector("#funnel-container");s&&Pi(s,this.currentDetails.funnel),this.bindEvents()}renderPipelineBoard(e){let n=["applied","screening","interview","offer","hired"],r=["rejected","withdrawn"];return`
      <div class="pipeline-stages-grid">
        ${n.map(i=>{let s=e.filter(a=>a.stage===i);return`
            <div class="pipeline-column stage-col-${i}">
              <div class="col-header">
                <span class="col-title">${i.toUpperCase()}</span>
                <span class="col-count">${s.length}</span>
              </div>
              <div class="col-cards-list">
                ${s.length===0?`
                  <div class="col-empty-card">No candidates</div>
                `:`
                  ${s.map(a=>this.renderCandidateCard(a)).join("")}
                `}
              </div>
            </div>
          `}).join("")}

        <!-- Terminal Column -->
        <div class="pipeline-column stage-col-terminal">
          <div class="col-header">
            <span class="col-title">TERMINAL</span>
            <span class="col-count">${e.filter(i=>r.includes(i.stage)).length}</span>
          </div>
          <div class="col-cards-list">
            ${e.filter(i=>r.includes(i.stage)).map(i=>this.renderCandidateCard(i)).join("")}
          </div>
        </div>
      </div>
    `}renderCandidateCard(e){let n=e.stage==="interview",r=e.offer_eligibility?.eligible;return`
      <div class="candidate-card ${e.is_terminal?"card-terminal":""}" data-cand-id="${e.id}" tabindex="0" role="button" aria-label="Candidate ${e.name}, ${e.stage}">
        <div class="card-top-row">
          <strong class="cand-name">${e.name}</strong>
          <span class="cand-id">${e.id}</span>
        </div>

        <div class="card-meta-row">
          <span class="cand-stage-pill stage-${e.stage}">${e.stage}</span>
          <span class="cand-version-pill">v${e.assessment_version}</span>
          <span class="cand-days">${e.days_since_applied}d</span>
        </div>

        ${n?`
          <div class="card-readiness-row">
            ${r?`
              <span class="readiness-pill ready">\u2713 Offer Ready</span>
            `:`
              <span class="readiness-pill blocked" title="${e.offer_eligibility?.reasons?.join("; ")}">\u26A0 Blocked</span>
            `}
            <span class="score-summary">
              ${e.current_scores.length}/${e.panel.length} scored
            </span>
          </div>
        `:""}

        ${e.panel.length>0?`
          <div class="card-panel-row">
            <span class="panel-icon" aria-hidden="true">\u{1F465}</span>
            <span class="panel-names">${e.panel.map(i=>i.name.split(" ")[0]).join(", ")}</span>
          </div>
        `:""}

        ${e.notes.length>0?`
          <div class="card-notes-count">
            \u{1F4AC} ${e.notes.length} note${e.notes.length===1?"":"s"}
          </div>
        `:""}
      </div>
    `}renderActivityTrail(e){return e.length===0?'<div class="empty-activity-box">No recorded activity for this vacancy yet.</div>':`
      <div class="activity-table-wrapper">
        <table class="activity-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Description</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            ${e.map(n=>`
              <tr>
                <td class="cell-time">${new Date(n.created_at).toLocaleTimeString()}</td>
                <td class="cell-type"><span class="activity-badge badge-${n.action_type}">${n.action_type.replace("_"," ")}</span></td>
                <td class="cell-desc">${n.description}</td>
                <td class="cell-actor">${n.actor_name}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `}bindEvents(){this.container.querySelectorAll(".vacancy-tab-btn").forEach(l=>{l.addEventListener("click",()=>{let c=l.getAttribute("data-code");c&&this.callbacks.onSelectVacancy(c)})});let n=this.container.querySelector("#add-candidate-btn");n&&n.addEventListener("click",()=>{this.callbacks.onOpenAddCandidate()});let r=this.container.querySelector("#batch-offers-btn");r&&r.addEventListener("click",()=>{this.callbacks.onOpenBatchOffers()});let i=this.container.querySelector("#refresh-vacancy-btn");i&&i.addEventListener("click",()=>{this.callbacks.onRefresh()}),this.container.querySelectorAll(".candidate-card").forEach(l=>{let c=()=>{let u=l.getAttribute("data-cand-id");if(!u||!this.currentDetails)return;let f=this.currentDetails.candidates.find(d=>d.id===u);f&&this.callbacks.onOpenCandidate(f)};l.addEventListener("click",c),l.addEventListener("keydown",u=>{let f=u;(f.key==="Enter"||f.key===" ")&&(u.preventDefault(),c())})});let a=this.container.querySelector("#tab-pipeline-btn");a&&a.addEventListener("click",()=>{this.activeTab="pipeline",this.render()});let o=this.container.querySelector("#tab-activity-btn");o&&o.addEventListener("click",()=>{this.activeTab="activity",this.render()})}};var xe=class{container;candidate=null;vacancy=null;currentUser=null;callbacks;isSubmitting=!1;constructor(e,n){this.container=e,this.callbacks=n}show(e,n,r){this.candidate=e,this.vacancy=n,this.currentUser=r,this.render()}updateData(e,n){this.candidate=e,this.vacancy=n,this.render()}close(){this.candidate=null,this.container.innerHTML="",this.container.classList.remove("open"),this.callbacks.onClose()}render(){if(!this.candidate||!this.vacancy||!this.currentUser){this.container.innerHTML="",this.container.classList.remove("open");return}let e=this.candidate,n=this.vacancy.vacancy,r=this.currentUser;this.container.classList.add("open"),this.container.innerHTML=`
      <div class="drawer-backdrop" id="drawer-backdrop"></div>
      <div class="drawer-content" role="dialog" aria-modal="true" aria-labelledby="drawer-candidate-title">
        <div class="drawer-header">
          <div class="drawer-header-meta">
            <span class="cand-id-badge">${e.id}</span>
            <span class="cand-stage-badge stage-${e.stage}">${e.stage.toUpperCase()}</span>
            <span class="cand-version-badge">Assessment v${e.assessment_version}</span>
          </div>
          <h2 id="drawer-candidate-title" class="drawer-title">${e.name}</h2>
          <div class="drawer-subtitle">
            <span>Vacancy: <strong>${n.title} (${n.code})</strong></span>
            <span>\u2022</span>
            <span>Applied: ${e.days_since_applied} days ago</span>
          </div>
          <button class="drawer-close-btn" id="drawer-close-btn" aria-label="Close drawer">&times;</button>
        </div>

        <div class="drawer-body">
          <!-- Stage Progress Bar -->
          <div class="drawer-section">
            <h3 class="section-heading">Pipeline Stage</h3>
            <div class="stage-stepper" role="list">
              ${["applied","screening","interview","offer","hired"].map(i=>{let s=e.stage===i,a=e.history.includes(i),o=e.stage==="rejected"||e.stage==="withdrawn";return`
                  <div class="step-item ${s?"current":""} ${a?"visited":""}" role="listitem">
                    <div class="step-circle">${a?"\u2713":""}</div>
                    <span class="step-name">${i}</span>
                  </div>
                `}).join("")}
            </div>
            ${e.is_terminal?`
              <div class="terminal-banner terminal-${e.stage}">
                <strong>Application ${e.stage.toUpperCase()}</strong>
                <p>This is a terminal record. Further stage progression is closed.</p>
              </div>
            `:""}
          </div>

          <!-- Offer Gate / Readiness Block -->
          ${e.stage==="interview"?`
            <div class="drawer-section offer-readiness-card ${e.offer_eligibility.eligible?"ready":"blocked"}">
              <div class="readiness-header">
                <span class="readiness-badge ${e.offer_eligibility.eligible?"badge-ready":"badge-blocked"}">
                  ${e.offer_eligibility.eligible?"\u2713 OFFER READY":"\u26A0 OFFER BLOCKED"}
                </span>
                <span class="readiness-summary">
                  ${e.offer_eligibility.eligible?`Assessment complete with ${e.current_scores.length} scores. ${n.available} opening(s) available.`:"Prerequisites must be met before an offer can be extended."}
                </span>
              </div>
              ${e.offer_eligibility.eligible?"":`
                <ul class="blocked-reasons-list">
                  ${e.offer_eligibility.reasons.map(i=>`<li>${i}</li>`).join("")}
                </ul>
              `}
            </div>
          `:""}

          <!-- Stage Actions (Ruth - Hiring Manager) -->
          <div class="drawer-section">
            <h3 class="section-heading">Stage Actions</h3>
            ${r.role==="hiring manager"?`
              ${e.is_terminal?`
                <p class="section-hint">Terminal applications cannot be transitioned.</p>
              `:`
                <div class="action-buttons-group">
                  ${this.renderStageButtons(e,n.available)}
                </div>
              `}
            `:`
              <div class="role-notice">
                <span>\u{1F512} Only the hiring manager (Ruth Aldane) can change applicant stages.</span>
              </div>
            `}
          </div>

          <!-- Assessment Freshness & Scores -->
          <div class="drawer-section">
            <div class="section-heading-row">
              <h3 class="section-heading">Assessment Freshness & Scores</h3>
              <span class="version-tag">Current Version: ${e.assessment_version}</span>
            </div>
            <p class="section-hint">
              Advancing into interview or modifying the panel creates a fresh assessment version.
              Every assigned panel member must score again in the current version.
            </p>

            <div class="scores-container">
              <h4 class="sub-heading">Current Assessment (v${e.assessment_version})</h4>
              ${e.panel.length===0?`
                <div class="empty-panel-notice">No panel members assigned yet.</div>
              `:`
                <div class="scores-list">
                  ${e.panel.map(i=>{let s=e.current_scores.find(a=>a.scorer_email===i.email);return`
                      <div class="score-card">
                        <div class="score-card-member">
                          <strong>${i.name}</strong>
                          <span class="member-email">${i.email}</span>
                        </div>
                        <div class="score-card-val">
                          ${s?`
                            <span class="score-badge val-${s.score}">${s.score} / 5</span>
                          `:`
                            <span class="score-badge val-pending">Pending Score</span>
                          `}
                        </div>
                      </div>
                    `}).join("")}
                </div>
              `}

              <!-- Interactive Scoring Controls -->
              ${this.renderScoringInput(e,r)}

              <!-- Historical Scores -->
              ${e.historical_scores.length>0?`
                <div class="historical-scores-section">
                  <h4 class="sub-heading">Historical Scores</h4>
                  <div class="historical-scores-list">
                    ${e.historical_scores.map(i=>`
                      <div class="historical-score-item">
                        <span class="hist-version">Version ${i.assessment_version}</span>
                        <span class="hist-scorer">${i.scorer_name}</span>
                        <span class="hist-score">${i.score} / 5</span>
                        <span class="hist-tag">Historical</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `:""}
            </div>
          </div>

          <!-- Interview Panel Arrangement (Coordinator - Cal) -->
          <div class="drawer-section">
            <h3 class="section-heading">Interview Panel</h3>
            ${e.is_frozen?`
              <div class="frozen-banner">
                <span>\u{1F512} Panel assignments are frozen in stage <strong>${e.stage}</strong>. Reopen interview to revise.</span>
              </div>
            `:""}

            <div class="panel-members-list">
              ${e.panel.length===0?`
                <div class="empty-panel-notice">No panel members assigned. Minimum 2 required for offer.</div>
              `:`
                ${e.panel.map(i=>`
                  <div class="panel-member-row">
                    <div class="member-info">
                      <span class="member-name">${i.name}</span>
                      <span class="member-email">${i.email}</span>
                    </div>
                    ${r.role==="coordinator"&&!e.is_frozen?`
                      <button class="btn btn-sm btn-danger remove-panel-btn" data-email="${i.email}">Remove</button>
                    `:""}
                  </div>
                `).join("")}
              `}
            </div>

            ${r.role==="coordinator"&&!e.is_frozen?`
              <div class="add-panel-box">
                <label for="panel-member-select">Assign Panel Member:</label>
                <div class="add-panel-controls">
                  <select id="panel-member-select" class="form-select">
                    <option value="">-- Select eligible member --</option>
                    <option value="hiring@pellmoor.test" ${e.panel.some(i=>i.email==="hiring@pellmoor.test")?"disabled":""}>Ruth Aldane (Hiring Manager)</option>
                    <option value="panel1@pellmoor.test" ${e.panel.some(i=>i.email==="panel1@pellmoor.test")?"disabled":""}>Otis Barre (Panel)</option>
                    <option value="panel2@pellmoor.test" ${e.panel.some(i=>i.email==="panel2@pellmoor.test")?"disabled":""}>Wren Foss (Panel)</option>
                  </select>
                  <button id="add-panel-btn" class="btn btn-sm btn-primary">Add Member</button>
                </div>
              </div>
            `:r.role!=="coordinator"?`
              <div class="role-notice">
                <span>\u{1F512} Only the coordinator (Cal Meriden) can modify panel assignments.</span>
              </div>
            `:""}
          </div>

          <!-- Notes Section (All Roles) -->
          <div class="drawer-section">
            <h3 class="section-heading">Notes</h3>
            <div class="notes-list">
              ${e.notes.length===0?`
                <div class="empty-notes-notice">No notes recorded yet.</div>
              `:`
                ${e.notes.map(i=>`
                  <div class="note-card">
                    <div class="note-meta">
                      <strong>${i.author_name}</strong>
                      <span class="note-time">${new Date(i.created_at).toLocaleString()}</span>
                    </div>
                    <div class="note-text">${i.text}</div>
                  </div>
                `).join("")}
              `}
            </div>

            <div class="add-note-box">
              <label for="new-note-text">Add a note (append-only):</label>
              <textarea id="new-note-text" class="form-textarea" placeholder="Enter note observations..." rows="3"></textarea>
              <button id="submit-note-btn" class="btn btn-sm btn-secondary">Post Note</button>
            </div>
          </div>

          <!-- Activity Trail for Candidate -->
          <div class="drawer-section">
            <h3 class="section-heading">Candidate Activity Log</h3>
            <div class="candidate-activity-list">
              ${this.renderCandidateActivity(e.id,this.vacancy.activity)}
            </div>
          </div>
        </div>
      </div>
    `,this.bindEvents()}renderStageButtons(e,n){let r=[];if(e.stage==="applied")r.push('<button class="btn btn-primary stage-action-btn" data-target="screening">Advance to Screening</button>');else if(e.stage==="screening")r.push('<button class="btn btn-primary stage-action-btn" data-target="interview">Advance to Interview</button>');else if(e.stage==="interview"){let i=e.offer_eligibility.eligible;r.push(`
        <button class="btn btn-success stage-action-btn ${i?"":"disabled-btn"}"
          data-target="offer"
          ${i?"":"disabled"}
          title="${i?"Extend offer":e.offer_eligibility.reasons.join(", ")}">
          Extend Offer
        </button>
      `)}else e.stage==="offer"&&r.push('<button class="btn btn-success stage-action-btn" data-target="hired">Mark as Hired</button>');return e.stage==="screening"?r.push('<button class="btn btn-outline stage-action-btn" data-target="applied">Return to Applied</button>'):e.stage==="interview"?r.push('<button class="btn btn-outline stage-action-btn" data-target="screening">Return to Screening</button>'):e.stage==="offer"?r.push('<button class="btn btn-outline stage-action-btn" data-target="interview">Reopen Interview</button>'):e.stage==="hired"&&r.push('<button class="btn btn-outline stage-action-btn" data-target="offer">Reopen Offer</button>'),r.push('<button class="btn btn-danger-outline stage-action-btn" data-target="rejected">Reject</button>'),r.push('<button class="btn btn-neutral-outline stage-action-btn" data-target="withdrawn">Withdraw</button>'),r.join("")}renderScoringInput(e,n){if(e.stage!=="interview"||!e.panel.some(s=>s.email===n.email))return"";let i=e.current_scores.find(s=>s.scorer_email===n.email);return`
      <div class="submit-score-box">
        <label><strong>Your Score as ${n.name} (v${e.assessment_version}):</strong></label>
        <div class="score-input-row">
          <div class="score-radios" role="radiogroup" aria-label="Score from 1 to 5">
            ${[1,2,3,4,5].map(s=>`
              <label class="score-radio-label ${i?.score===s?"selected":""}">
                <input type="radio" name="candidate-score" value="${s}" ${i?.score===s?"checked":""}>
                <span>${s}</span>
              </label>
            `).join("")}
          </div>
          <button id="submit-score-btn" class="btn btn-primary btn-sm">
            ${i?"Update Score":"Submit Score"}
          </button>
        </div>
      </div>
    `}renderCandidateActivity(e,n){let r=n.filter(i=>i.candidate_id===e);return r.length===0?'<div class="empty-activity-notice">No recorded activity for this candidate.</div>':r.map(i=>`
      <div class="activity-timeline-item">
        <div class="activity-header">
          <span class="activity-type-tag tag-${i.action_type}">${i.action_type.replace("_"," ")}</span>
          <span class="activity-time">${new Date(i.created_at).toLocaleString()}</span>
        </div>
        <div class="activity-desc">${i.description}</div>
        <div class="activity-actor">by ${i.actor_name} (${i.actor_email})</div>
      </div>
    `).join("")}bindEvents(){if(!this.candidate||!this.vacancy||!this.currentUser)return;let e=this.candidate,n=this.vacancy,r=this.container.querySelector("#drawer-close-btn");r&&r.addEventListener("click",()=>this.close());let i=this.container.querySelector("#drawer-backdrop");i&&i.addEventListener("click",()=>this.close()),this.container.querySelectorAll(".stage-action-btn").forEach(u=>{u.addEventListener("click",async f=>{if(this.isSubmitting)return;let d=f.currentTarget.getAttribute("data-target");if(d)try{this.isSubmitting=!0;let p=L(),h=await kn(e.id,d,n.vacancy.revision,p);this.isSubmitting=!1,this.callbacks.onUpdated(h.vacancy,h.candidate)}catch(p){this.isSubmitting=!1,this.callbacks.onError(p)}})});let a=this.container.querySelector("#submit-score-btn");a&&a.addEventListener("click",async()=>{if(this.isSubmitting)return;let u=this.container.querySelector('input[name="candidate-score"]:checked');if(!u){alert("Please select a score from 1 to 5");return}let f=parseInt(u.value,10);try{this.isSubmitting=!0;let d=L(),p=await Sn(e.id,f,n.vacancy.revision,d);this.isSubmitting=!1,this.callbacks.onUpdated(p.vacancy,p.candidate)}catch(d){this.isSubmitting=!1,this.callbacks.onError(d)}});let o=this.container.querySelector("#add-panel-btn");o&&o.addEventListener("click",async()=>{if(this.isSubmitting)return;let f=this.container.querySelector("#panel-member-select")?.value;if(!f){alert("Please select an eligible panel member");return}try{this.isSubmitting=!0;let d=L(),p=await Se(e.id,"add",f,n.vacancy.revision,d);this.isSubmitting=!1,this.callbacks.onUpdated(p.vacancy,p.candidate)}catch(d){this.isSubmitting=!1,this.callbacks.onError(d)}}),this.container.querySelectorAll(".remove-panel-btn").forEach(u=>{u.addEventListener("click",async f=>{if(this.isSubmitting)return;let d=f.currentTarget.getAttribute("data-email");if(d)try{this.isSubmitting=!0;let p=L(),h=await Se(e.id,"remove",d,n.vacancy.revision,p);this.isSubmitting=!1,this.callbacks.onUpdated(h.vacancy,h.candidate)}catch(p){this.isSubmitting=!1,this.callbacks.onError(p)}})});let c=this.container.querySelector("#submit-note-btn");c&&c.addEventListener("click",async()=>{if(this.isSubmitting)return;let f=this.container.querySelector("#new-note-text")?.value?.trim();if(!f){alert("Please enter note text");return}try{this.isSubmitting=!0;let d=L(),p=await Cn(e.id,f,n.vacancy.revision,d);this.isSubmitting=!1,this.callbacks.onUpdated(p.vacancy,p.candidate)}catch(d){this.isSubmitting=!1,this.callbacks.onError(d)}})}};var we=class{container;vacancy;callbacks;currentStep="select";selectedCandidateIds=[];previewData=null;isSubmitting=!1;currentOperationId="";lastReviewedRevision=0;successResult=null;conflictMessage=null;constructor(e,n,r){this.container=e,this.vacancy=n,this.callbacks=r,this.currentOperationId=L(),this.lastReviewedRevision=n.vacancy.revision}show(){let e=this.vacancy.candidates.filter(n=>n.stage==="interview");this.selectedCandidateIds=e.filter(n=>n.offer_eligibility.eligible).map(n=>n.id),this.currentStep="select",this.render()}updateVacancy(e){this.vacancy=e,this.render()}close(){this.container.innerHTML="",this.container.classList.remove("open"),this.callbacks.onClose()}render(){this.container.classList.add("open"),this.container.innerHTML=`
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal-dialog modal-batch" role="dialog" aria-modal="true" aria-labelledby="batch-modal-title">
        <div class="modal-header">
          <div>
            <h2 id="batch-modal-title" class="modal-title">Atomic Batch Offers</h2>
            <div class="modal-subtitle">
              <span>Vacancy: <strong>${this.vacancy.vacancy.title} (${this.vacancy.vacancy.code})</strong></span>
              <span>\u2022</span>
              <span>Revision: ${this.vacancy.vacancy.revision}</span>
            </div>
          </div>
          <button class="modal-close-btn" id="modal-close-btn" aria-label="Close modal">&times;</button>
        </div>

        <div class="modal-body">
          ${this.conflictMessage?`
            <div class="conflict-alert" role="alert">
              <strong>\u26A0 State Conflict (409)</strong>
              <p>${this.conflictMessage}</p>
            </div>
          `:""}

          ${this.currentStep==="select"?this.renderSelectStep():""}
          ${this.currentStep==="review"?this.renderReviewStep():""}
          ${this.currentStep==="success"?this.renderSuccessStep():""}
        </div>
      </div>
    `,this.bindEvents()}renderSelectStep(){let e=this.vacancy.vacancy,n=this.vacancy.candidates.filter(a=>a.stage==="interview"),r=this.selectedCandidateIds.length,i=e.reserved+r,s=Math.max(0,e.openings-i-e.filled);return`
      <div class="batch-step-content">
        <div class="batch-capacity-preview">
          <div class="capacity-box">
            <span class="cap-lbl">Current Openings</span>
            <span class="cap-val">${e.openings} Total</span>
            <div class="cap-breakdown">
              <span>${e.reserved} Reserved</span> \u2022 <span>${e.filled} Filled</span> \u2022 <strong class="available-txt">${e.available} Available</strong>
            </div>
          </div>
          <div class="capacity-arrow">\u279C</div>
          <div class="capacity-box projected">
            <span class="cap-lbl">Projected Capacity</span>
            <span class="cap-val">${r} Selected</span>
            <div class="cap-breakdown">
              <span>${i} Reserved</span> \u2022 <span>${e.filled} Filled</span> \u2022 <strong class="${s<0||r>e.available?"overbooked-txt":"available-txt"}">${s} Available</strong>
            </div>
          </div>
        </div>

        <h3 class="sub-heading">Select Interview Applicants for Offer</h3>
        <p class="section-hint">
          Every selected candidate must have at least 2 panel members, no lone hiring manager, and full scores in their current assessment version.
        </p>

        ${n.length===0?`
          <div class="empty-batch-notice">
            No candidates are currently in the <strong>Interview</strong> stage for this vacancy.
          </div>
        `:`
          <div class="batch-candidate-checklist">
            ${n.map(a=>{let o=this.selectedCandidateIds.includes(a.id),l=a.offer_eligibility.eligible;return`
                <label class="batch-cand-row ${l?"":"ineligible-row"} ${o?"checked":""}">
                  <input type="checkbox" class="batch-cand-checkbox" value="${a.id}" ${o?"checked":""}>
                  <div class="batch-cand-info">
                    <div class="cand-name-row">
                      <strong>${a.name}</strong>
                      <span class="cand-id">${a.id}</span>
                      <span class="cand-ver">v${a.assessment_version}</span>
                    </div>
                    <div class="cand-details-row">
                      <span>Panel: ${a.panel.length} assigned (${a.panel.map(c=>c.name.split(" ")[0]).join(", ")||"None"})</span>
                      <span>\u2022</span>
                      <span>Scores: ${a.current_scores.length}/${a.panel.length} submitted</span>
                    </div>
                    ${l?`
                      <div class="eligible-badge-inline">\u2713 Complete Assessment</div>
                    `:`
                      <div class="ineligible-reasons-inline">
                        \u26A0 ${a.offer_eligibility.reasons.join("; ")}
                      </div>
                    `}
                  </div>
                </label>
              `}).join("")}
          </div>
        `}

        <div class="modal-footer">
          <button id="cancel-batch-btn" class="btn btn-outline">Cancel</button>
          <button id="review-batch-btn" class="btn btn-primary" ${r===0?"disabled":""}>
            Review ${r} Selected Offer${r===1?"":"s"} \u279C
          </button>
        </div>
      </div>
    `}renderReviewStep(){if(!this.previewData)return"";let e=this.previewData;return`
      <div class="batch-step-content">
        <div class="review-summary-card ${e.batch_eligible?"ready":"blocked"}">
          <div class="summary-header">
            <span class="summary-status-badge ${e.batch_eligible?"badge-ready":"badge-blocked"}">
              ${e.batch_eligible?"\u2713 BATCH READY TO EXTEND":"\u26A0 BATCH INELIGIBLE"}
            </span>
            <span class="summary-count-txt">
              ${e.selected_count} applicant${e.selected_count===1?"":"s"} selected
            </span>
          </div>

          <div class="capacity-review-grid">
            <div class="cap-review-item">
              <span class="rev-lbl">Available Before</span>
              <span class="rev-val">${e.current_capacity.available}</span>
            </div>
            <div class="cap-review-item">
              <span class="rev-lbl">Offers Requested</span>
              <span class="rev-val">${e.selected_count}</span>
            </div>
            <div class="cap-review-item">
              <span class="rev-lbl">Available After</span>
              <span class="rev-val ${e.projected_capacity.available<0?"overbooked-txt":""}">${e.projected_capacity.available}</span>
            </div>
          </div>

          ${e.batch_eligible?`
            <div class="batch-guarantee-note">
              This batch offer executes atomically. All ${e.selected_count} candidate(s) will move to Offer, reserving ${e.selected_count} opening(s) and advancing the vacancy revision exactly once.
            </div>
          `:`
            <div class="batch-blockers-box">
              <strong>Batch cannot be confirmed for the following reasons:</strong>
              <ul>
                ${e.batch_ineligible_reasons.map(n=>`<li>${n}</li>`).join("")}
              </ul>
            </div>
          `}
        </div>

        <h3 class="sub-heading">Selected Applicants (${e.candidates.length})</h3>
        <div class="review-candidates-list">
          ${e.candidates.map((n,r)=>`
            <div class="review-cand-item ${n.eligible?"":"item-ineligible"}">
              <div class="cand-item-header">
                <span class="cand-order">#${r+1}</span>
                <strong class="cand-name">${n.name}</strong>
                <span class="cand-id">${n.id}</span>
                <span class="cand-ver">Assessment v${n.assessment_version}</span>
                <span class="cand-elig-badge ${n.eligible?"elig-yes":"elig-no"}">
                  ${n.eligible?"Eligible":"Ineligible"}
                </span>
              </div>
              ${n.eligible?"":`
                <div class="cand-reasons-box">
                  ${n.reasons.map(i=>`<span>\u2022 ${i}</span>`).join("")}
                </div>
              `}
            </div>
          `).join("")}
        </div>

        <div class="modal-footer">
          <button id="back-to-select-btn" class="btn btn-outline" ${this.isSubmitting?"disabled":""}>\u2190 Back to Selection</button>
          <button id="confirm-batch-btn" class="btn btn-success"
            ${!e.batch_eligible||this.isSubmitting?"disabled":""}>
            ${this.isSubmitting?"Confirming Batch Offers...":`Confirm & Extend ${e.selected_count} Offer${e.selected_count===1?"":"s"}`}
          </button>
        </div>
      </div>
    `}renderSuccessStep(){let e=this.successResult;return e?`
      <div class="batch-step-content success-step">
        <div class="success-icon" aria-hidden="true">\u2713</div>
        <h3 class="success-title">Batch Offers Successfully Extended!</h3>
        <p class="success-desc">
          ${e.batch_size} candidate(s) have been transitioned to the <strong>Offer</strong> stage.
        </p>

        <div class="batch-receipt-card">
          <div class="receipt-row">
            <span class="receipt-lbl">Batch Operation ID</span>
            <span class="receipt-val batch-id-txt">${e.batch_id}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-lbl">Vacancy</span>
            <span class="receipt-val">${this.vacancy.vacancy.title} (${this.vacancy.vacancy.code})</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-lbl">Offers Extended</span>
            <span class="receipt-val">${e.batch_size}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-lbl">New Vacancy Revision</span>
            <span class="receipt-val">${this.vacancy.vacancy.revision}</span>
          </div>
        </div>

        <div class="modal-footer center-footer">
          <button id="finish-batch-btn" class="btn btn-primary">Done & View Pipeline</button>
        </div>
      </div>
    `:""}bindEvents(){let e=this.container.querySelector("#modal-close-btn");e&&e.addEventListener("click",()=>this.close());let n=this.container.querySelector("#modal-backdrop");n&&n.addEventListener("click",()=>{this.isSubmitting||this.close()}),this.container.querySelectorAll(".batch-cand-checkbox").forEach(c=>{c.addEventListener("change",u=>{let f=u.target,d=f.value;f.checked?this.selectedCandidateIds.includes(d)||this.selectedCandidateIds.push(d):this.selectedCandidateIds=this.selectedCandidateIds.filter(p=>p!==d),this.render()})});let i=this.container.querySelector("#cancel-batch-btn");i&&i.addEventListener("click",()=>this.close());let s=this.container.querySelector("#review-batch-btn");s&&s.addEventListener("click",async()=>{if(this.selectedCandidateIds.length!==0)try{this.conflictMessage=null;let c=await Ce(this.vacancy.vacancy.code,this.selectedCandidateIds);this.previewData=c,this.lastReviewedRevision=this.vacancy.vacancy.revision,this.currentStep="review",this.render()}catch(c){this.callbacks.onError(c)}});let a=this.container.querySelector("#back-to-select-btn");a&&a.addEventListener("click",()=>{this.currentStep="select",this.render()});let o=this.container.querySelector("#confirm-batch-btn");o&&o.addEventListener("click",async()=>{if(!(this.isSubmitting||!this.previewData||!this.previewData.batch_eligible))try{this.isSubmitting=!0,this.render();let c=await $n(this.vacancy.vacancy.code,this.selectedCandidateIds,this.lastReviewedRevision,this.currentOperationId);this.isSubmitting=!1,this.successResult={batch_id:c.batch_id,batch_size:c.batch_size},this.vacancy=c.vacancy,this.currentStep="success",this.callbacks.onCompleted(c.vacancy),this.render()}catch(c){if(this.isSubmitting=!1,c.status===409){this.conflictMessage="Vacancy revision has changed since you reviewed this batch. Please re-review the current pipeline before proceeding.",this.currentOperationId=L();try{let u=await Ce(this.vacancy.vacancy.code,this.selectedCandidateIds);this.previewData=u,this.lastReviewedRevision=u.current_capacity.revision}catch{}}this.render(),this.callbacks.onError(c)}});let l=this.container.querySelector("#finish-batch-btn");l&&l.addEventListener("click",()=>{this.close()})}};var _e=class{container;vacancies;selectedVacancyCode;currentRevision;callbacks;isSubmitting=!1;constructor(e,n,r,i,s){this.container=e,this.vacancies=n,this.selectedVacancyCode=r,this.currentRevision=i,this.callbacks=s}show(){this.render()}close(){this.container.innerHTML="",this.container.classList.remove("open"),this.callbacks.onClose()}render(){this.container.classList.add("open"),this.container.innerHTML=`
      <div class="modal-backdrop" id="add-cand-backdrop"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="add-cand-title">
        <div class="modal-header">
          <h2 id="add-cand-title" class="modal-title">Add Candidate to Pipeline</h2>
          <button class="modal-close-btn" id="add-cand-close-btn" aria-label="Close modal">&times;</button>
        </div>

        <form id="add-cand-form" class="modal-form">
          <div class="form-group">
            <label for="cand-name-input">Candidate Full Name:</label>
            <input type="text" id="cand-name-input" class="form-input" placeholder="e.g. Robin Sterling" required autofocus>
          </div>

          <div class="form-group">
            <label for="cand-vacancy-select">Target Vacancy:</label>
            <select id="cand-vacancy-select" class="form-select">
              ${this.vacancies.map(e=>`
                <option value="${e.code}" ${e.code===this.selectedVacancyCode?"selected":""}>
                  ${e.title} (${e.code}) - ${e.available} opening(s) available
                </option>
              `).join("")}
            </select>
          </div>

          <div class="modal-info-box">
            <span>\u2139 Candidate will enter the pipeline at stage <strong>Applied</strong> with <strong>Assessment Version 1</strong>.</span>
          </div>

          <div class="modal-footer">
            <button type="button" id="add-cand-cancel-btn" class="btn btn-outline">Cancel</button>
            <button type="submit" id="add-cand-submit-btn" class="btn btn-primary" ${this.isSubmitting?"disabled":""}>
              ${this.isSubmitting?"Adding Candidate...":"Add Candidate"}
            </button>
          </div>
        </form>
      </div>
    `,this.bindEvents()}bindEvents(){let e=this.container.querySelector("#add-cand-close-btn");e&&e.addEventListener("click",()=>this.close());let n=this.container.querySelector("#add-cand-cancel-btn");n&&n.addEventListener("click",()=>this.close());let r=this.container.querySelector("#add-cand-backdrop");r&&r.addEventListener("click",()=>{this.isSubmitting||this.close()});let i=this.container.querySelector("#add-cand-form");i&&i.addEventListener("submit",async s=>{if(s.preventDefault(),this.isSubmitting)return;let a=this.container.querySelector("#cand-name-input"),o=this.container.querySelector("#cand-vacancy-select"),l=a?.value?.trim(),c=o?.value;if(!(!l||!c))try{this.isSubmitting=!0,this.render();let u=L(),f=await _n(c,l,this.currentRevision,u);this.isSubmitting=!1,this.close(),this.callbacks.onCreated(f.candidate,f.vacancy)}catch(u){this.isSubmitting=!1,this.render(),this.callbacks.onError(u)}})}};var pn=class{headerContainer;appContainer;drawerContainer;modalContainer;notificationContainer;currentUser=null;vacancies=[];selectedVacancyCode="";currentVacancyDetails=null;selectedCandidateId=null;vacancyView=null;candidateDrawer=null;batchOfferModal=null;addCandidateModal=null;constructor(){this.headerContainer=document.getElementById("header-root"),this.appContainer=document.getElementById("app-root"),this.drawerContainer=document.getElementById("drawer-root"),this.modalContainer=document.getElementById("modal-root"),this.notificationContainer=document.getElementById("notification-root"),this.candidateDrawer=new xe(this.drawerContainer,{onUpdated:(e,n)=>{this.currentVacancyDetails=e,this.updateVacanciesSummary(e.vacancy),this.selectedCandidateId=n.id,this.updateHash(),this.renderWorkspace(),this.candidateDrawer&&this.candidateDrawer.updateData(n,e),this.showToast("Candidate updated successfully","success")},onClose:()=>{this.selectedCandidateId=null,this.updateHash()},onError:e=>{this.handleError(e)}}),window.addEventListener("hashchange",()=>{this.readHash()}),window.addEventListener("keydown",e=>{e.key==="Escape"&&(this.batchOfferModal?(this.batchOfferModal.close(),this.batchOfferModal=null):this.addCandidateModal?(this.addCandidateModal.close(),this.addCandidateModal=null):this.candidateDrawer&&this.candidateDrawer.close())})}async init(){Mn();try{this.currentUser=await bn()}catch{this.currentUser=null}this.currentUser?await this.loadWorkspace():this.renderLoginPage()}renderHeader(){An(this.headerContainer,this.currentUser,{onLogout:async()=>{await yn(),this.currentUser=null,this.currentVacancyDetails=null,this.selectedCandidateId=null,this.renderLoginPage()}})}renderLoginPage(){this.renderHeader(),this.vacancyView=null,this.drawerContainer.innerHTML="",this.modalContainer.innerHTML="",Tn(this.appContainer,{onLoginSuccess:async e=>{this.currentUser=e,await this.loadWorkspace()}})}async loadWorkspace(){this.renderHeader(),this.appContainer.innerHTML='<div class="loading-state">Loading workspace records...</div>';try{if(this.vacancies=await xn(),this.vacancies.length===0){this.appContainer.innerHTML='<div class="empty-state">No vacancies found.</div>';return}this.readHash(),(!this.selectedVacancyCode||!this.vacancies.some(e=>e.code===this.selectedVacancyCode))&&(this.selectedVacancyCode=this.vacancies[0].code),await this.loadVacancy(this.selectedVacancyCode)}catch(e){this.handleError(e)}}async loadVacancy(e){try{if(this.selectedVacancyCode=e,this.currentVacancyDetails=await wn(e),this.updateVacanciesSummary(this.currentVacancyDetails.vacancy),this.updateHash(),this.renderWorkspace(),this.selectedCandidateId){let n=this.currentVacancyDetails.candidates.find(r=>r.id===this.selectedCandidateId);n&&this.candidateDrawer&&this.currentUser&&this.candidateDrawer.show(n,this.currentVacancyDetails,this.currentUser)}}catch(n){this.handleError(n)}}renderWorkspace(){!this.currentUser||!this.currentVacancyDetails||(this.vacancyView?this.vacancyView.update(this.vacancies,this.currentVacancyDetails):this.vacancyView=new be(this.appContainer,this.vacancies,this.currentVacancyDetails,this.currentUser,{onSelectVacancy:e=>{this.loadVacancy(e)},onOpenCandidate:e=>{this.selectedCandidateId=e.id,this.updateHash(),this.candidateDrawer&&this.currentVacancyDetails&&this.currentUser&&this.candidateDrawer.show(e,this.currentVacancyDetails,this.currentUser)},onOpenAddCandidate:()=>{this.openAddCandidateModal()},onOpenBatchOffers:()=>{this.openBatchOffersModal()},onRefresh:()=>{this.loadVacancy(this.selectedVacancyCode),this.showToast("Workspace refreshed","info")}}))}openAddCandidateModal(){this.currentVacancyDetails&&(this.addCandidateModal=new _e(this.modalContainer,this.vacancies,this.selectedVacancyCode,this.currentVacancyDetails.vacancy.revision,{onCreated:(e,n)=>{this.currentVacancyDetails=n,this.updateVacanciesSummary(n.vacancy),this.renderWorkspace(),this.showToast(`Candidate ${e.name} (${e.id}) added!`,"success"),this.selectedCandidateId=e.id,this.updateHash(),this.candidateDrawer&&this.currentUser&&this.candidateDrawer.show(e,n,this.currentUser)},onClose:()=>{this.addCandidateModal=null},onError:e=>{this.handleError(e)}}),this.addCandidateModal.show())}openBatchOffersModal(){this.currentVacancyDetails&&(this.batchOfferModal=new we(this.modalContainer,this.currentVacancyDetails,{onCompleted:e=>{this.currentVacancyDetails=e,this.updateVacanciesSummary(e.vacancy),this.renderWorkspace(),this.showToast("Batch offers successfully extended!","success")},onClose:()=>{this.batchOfferModal=null},onError:e=>{this.handleError(e)}}),this.batchOfferModal.show())}updateVacanciesSummary(e){let n=this.vacancies.findIndex(r=>r.code===e.code);n!==-1&&(this.vacancies[n]={...this.vacancies[n],...e})}updateHash(){let e=new URLSearchParams;this.selectedVacancyCode&&e.set("vacancy",this.selectedVacancyCode),this.selectedCandidateId&&e.set("candidate",this.selectedCandidateId);let n="#"+e.toString();window.location.hash!==n&&history.replaceState(null,"",n)}readHash(){let e=window.location.hash.replace(/^#/,""),n=new URLSearchParams(e),r=n.get("vacancy"),i=n.get("candidate");r&&(this.selectedVacancyCode=r),this.selectedCandidateId=i}handleError(e){let n=e.message||"An unexpected error occurred";e.status===409?(this.showToast(`Concurrency Conflict: ${n}`,"warning"),this.selectedVacancyCode&&this.loadVacancy(this.selectedVacancyCode)):e.status===401?(this.showToast("Session expired. Please sign in again.","danger"),this.currentUser=null,this.renderLoginPage()):this.showToast(n,"danger")}showToast(e,n="info"){let r=document.createElement("div");r.className=`toast-notification toast-${n}`,r.innerHTML=`
      <span class="toast-icon">${n==="success"?"\u2713":n==="warning"?"\u26A0":n==="danger"?"\u2716":"\u2139"}</span>
      <span class="toast-msg">${e}</span>
      <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
    `,r.querySelector(".toast-dismiss")?.addEventListener("click",()=>{r.remove()}),this.notificationContainer.appendChild(r),setTimeout(()=>{r.classList.add("fade-out"),setTimeout(()=>r.remove(),300)},4500)}};document.addEventListener("DOMContentLoaded",()=>{new pn().init()});})();
//# sourceMappingURL=bundle.js.map

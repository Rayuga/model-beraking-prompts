(()=>{var w=Object.defineProperty;var f=(l,e,t)=>e in l?w(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t;var d=(l,e,t)=>(f(l,typeof e!="symbol"?e+"":e,t),t);var m=class{constructor(){d(this,"currentVacancy",null);d(this,"vacancies",[])}setToken(e){localStorage.setItem("auth_token",e)}getToken(){return localStorage.getItem("auth_token")}clearToken(){localStorage.removeItem("auth_token")}setVacancies(e){this.vacancies=e}getVacancies(){return this.vacancies}setCurrentVacancy(e){this.currentVacancy=e}getCurrentVacancy(){return this.currentVacancy}setTheme(e){localStorage.setItem("theme",e)}getTheme(){return localStorage.getItem("theme")||"light"}setBatchOperation(e,t){sessionStorage.setItem(`batch_${e}`,JSON.stringify(t))}getBatchOperation(e){let t=sessionStorage.getItem(`batch_${e}`);return t?JSON.parse(t):null}clearBatchOperation(e){sessionStorage.removeItem(`batch_${e}`)}};var v=class{constructor(){d(this,"store");this.store=new m}async request(e,t,a,s={}){let n={"Content-Type":"application/json",...s},o=this.store.getToken();o&&(n.Authorization=`Bearer ${o}`);let r={method:e,headers:n};a&&(r.body=JSON.stringify(a));try{let c=await fetch(t,r),u=await c.json();if(!c.ok){let g=new Error(u.error||`HTTP ${c.status}`);throw g.status=c.status,g.response=u,g}return u}catch(c){throw c.status===401&&this.store.clearToken(),c}}async login(e,t){return this.request("POST","/auth/login",{email:e,password:t})}async logout(e){return this.request("POST","/auth/logout")}async validateSession(e){return this.request("GET","/auth/session",void 0,{Authorization:`Bearer ${e}`})}async getVacancies(){return this.request("GET","/api/vacancies")}async getVacancy(e){return this.request("GET",`/api/vacancies/${e}`)}async addCandidate(e,t){return this.request("POST",`/api/vacancies/${e}/candidates`,{name:t})}async moveCandidate(e,t,a,s){return this.request("POST",`/api/vacancies/${e}/candidates/${t}/move`,{nextStage:a,expectedRevision:s})}async getPanel(e){return this.request("GET",`/api/candidates/${e}/panel`)}async addPanelMember(e,t,a){return this.request("POST",`/api/candidates/${e}/panel/add`,{memberEmail:t,expectedRevision:a})}async removePanelMember(e,t,a){return this.request("POST",`/api/candidates/${e}/panel/remove`,{memberId:t,expectedRevision:a})}async recordScore(e,t){return this.request("POST",`/api/candidates/${e}/score`,{score:t})}async addNote(e,t){return this.request("POST",`/api/candidates/${e}/note`,{content:t})}async getNotes(e){return this.request("GET",`/api/candidates/${e}/notes`)}async previewBatchOffer(e,t,a){return this.request("POST",`/api/vacancies/${e}/batch-offer/preview`,{candidateIds:t,expectedRevision:a})}async commitBatchOffer(e,t,a,s){return this.request("POST",`/api/vacancies/${e}/batch-offer/commit`,{candidateIds:t,operationId:a,expectedRevision:s})}};var y=class{constructor(e){d(this,"app");d(this,"store");this.app=e,this.store=e.store,this.setupTheme()}setupTheme(){let e=this.store.getTheme();document.documentElement.setAttribute("data-theme",e)}toggleTheme(){let t=this.store.getTheme()==="light"?"dark":"light";this.store.setTheme(t),document.documentElement.setAttribute("data-theme",t)}showLoginPage(e){let t=document.getElementById("app");t.innerHTML=`
      <div class="login-container">
        <div class="login-box">
          <h1>Pellmoor Hiring</h1>
          <form id="login-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
          </form>
          <div class="demo-accounts">
            <p>Demo Accounts:</p>
            <ul>
              <li>hiring@pellmoor.test (Ruth Aldane, Hiring Manager)</li>
              <li>panel1@pellmoor.test (Otis Barre, Panel)</li>
              <li>panel2@pellmoor.test (Wren Foss, Panel)</li>
              <li>coord@pellmoor.test (Cal Meriden, Coordinator)</li>
            </ul>
            <p>Password: password123</p>
          </div>
        </div>
      </div>
    `,document.getElementById("login-form").addEventListener("submit",s=>{s.preventDefault();let n=document.getElementById("email").value,o=document.getElementById("password").value;e(n,o)})}showWorkspace(e,t){let a=document.getElementById("app");a.innerHTML=`
      <div class="workspace">
        <header class="workspace-header">
          <div class="header-left">
            <h1>Pellmoor Hiring</h1>
          </div>
          <div class="header-right">
            <button class="btn-theme" aria-label="Toggle theme">\u{1F319}</button>
            <div class="user-info">
              <span class="user-name">${e.name}</span>
              <span class="user-role">${e.role}</span>
            </div>
            <button class="btn btn-logout">Sign Out</button>
          </div>
        </header>
        <div class="workspace-body">
          <aside class="vacancies-sidebar">
            <div class="sidebar-header">
              <h2>Vacancies</h2>
            </div>
            <div id="vacancies-list" class="vacancies-list"></div>
          </aside>
          <main class="main-content">
            <div id="main-view" class="main-view">
              <div class="loading">Loading vacancies...</div>
            </div>
          </main>
          <aside id="candidate-drawer" class="candidate-drawer hidden">
            <div id="candidate-content"></div>
          </aside>
        </div>
      </div>
    `;let s=document.querySelector(".btn-theme");s.addEventListener("click",()=>{this.toggleTheme();let o=this.store.getTheme();s.textContent=o==="light"?"\u2600\uFE0F":"\u{1F319}"}),document.querySelector(".btn-logout").addEventListener("click",t)}updateVacanciesList(e,t){let a=document.getElementById("vacancies-list");if(e.length===0){a.innerHTML='<p class="empty">No vacancies</p>';return}a.innerHTML=e.map(n=>`
      <button class="vacancy-item" data-code="${n.code}">
        <div class="vacancy-title">${n.title}</div>
        <div class="vacancy-meta">${n.team} \u2022 ${n.openings} opening${n.openings!==1?"s":""}</div>
        <div class="vacancy-stats">
          <span class="stat">\u{1F4CD} ${n.stageCounts.applied||0}</span>
          <span class="stat">\u{1F4CB} ${n.stageCounts.screening||0}</span>
          <span class="stat">\u{1F4AC} ${n.stageCounts.interview||0}</span>
          <span class="stat">\u2705 ${n.stageCounts.hired||0}</span>
        </div>
      </button>
    `).join("");let s=a.querySelectorAll(".vacancy-item");s.forEach(n=>{n.addEventListener("click",()=>{s.forEach(r=>r.classList.remove("active")),n.classList.add("active");let o=n.dataset.code;t(o)})})}showVacancyDetails(e,t,a){let s=document.getElementById("main-view"),n=this.groupCandidatesByStage(e.candidates);if(s.innerHTML=`
      <div class="vacancy-view">
        <div class="vacancy-header">
          <div>
            <h2>${e.title}</h2>
            <p class="vacancy-meta">${e.team} \u2022 Role: ${e.code}</p>
          </div>
          <div class="capacity-display">
            <div class="capacity-item">
              <span class="capacity-label">Filled</span>
              <span class="capacity-value">${e.capacity.filled}</span>
            </div>
            <div class="capacity-item">
              <span class="capacity-label">Reserved</span>
              <span class="capacity-value">${e.capacity.reserved}</span>
            </div>
            <div class="capacity-item">
              <span class="capacity-label">Available</span>
              <span class="capacity-value ${e.capacity.available===0?"critical":""}">${e.capacity.available}</span>
            </div>
            <div class="capacity-item">
              <span class="capacity-label">Total</span>
              <span class="capacity-value">${e.capacity.total}</span>
            </div>
          </div>
        </div>

        ${t.role==="coordinator"?`
          <div class="add-candidate-section">
            <form id="add-candidate-form" class="add-candidate-form">
              <input type="text" id="candidate-name" placeholder="Add new candidate" required>
              <button type="submit" class="btn btn-small">Add</button>
            </form>
          </div>
        `:""}

        <div class="funnel-section">
          <div id="funnel-chart" class="funnel-chart"></div>
        </div>

        <div class="pipeline-view">
          ${["applied","screening","interview","offer","hired"].map(r=>`
            <div class="pipeline-stage">
              <h3>${this.stageName(r)}</h3>
              <div class="candidate-list">
                ${(n[r]||[]).map(c=>`
                  <button class="candidate-card" data-id="${c.id}">
                    <div class="candidate-name">${c.name}</div>
                    <div class="candidate-meta">${c.daysInStage} days</div>
                  </button>
                `).join("")}
                ${(n[r]||[]).length===0?'<p class="empty">No candidates</p>':""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `,t.role==="coordinator"){let r=document.getElementById("add-candidate-form");r?.addEventListener("submit",c=>{c.preventDefault();let u=document.getElementById("candidate-name").value;a.addCandidate(e.code,u),r.reset()})}s.querySelectorAll(".candidate-card").forEach(r=>{r.addEventListener("click",()=>{let c=r.dataset.id;a.selectCandidate(c)})}),this.renderFunnel(e.funnel)}groupCandidatesByStage(e){let t={applied:[],screening:[],interview:[],offer:[],hired:[],rejected:[],withdrawn:[]};return e.forEach(a=>{t[a.currentStage]&&t[a.currentStage].push({...a,daysInStage:Math.floor((Date.now()-new Date(a.updatedAt).getTime())/(1e3*60*60*24))})}),t}stageName(e){return{applied:"\u{1F4DD} Applied",screening:"\u{1F441}\uFE0F Screening",interview:"\u{1F4AC} Interview",offer:"\u{1F4BC} Offer",hired:"\u2705 Hired",rejected:"\u274C Rejected",withdrawn:"\u21A9\uFE0F Withdrawn"}[e]||e}renderFunnel(e){let t=document.getElementById("funnel-chart");if(!t)return;let s=`
      <div class="funnel">
        ${["applied","screening","interview","offer","hired"].map((n,o)=>{let r=e[n];return`
            <div class="funnel-stage" style="width: ${r.reached>0?100-o*15:0}%">
              <div class="funnel-label">${this.stageName(n)}</div>
              <div class="funnel-stats">
                <span>${r.reached} reached</span>
                ${r.remaining>0?`<span>${r.remaining} remaining</span>`:""}
                ${r.lost>0?`<span class="lost">${r.lost} lost</span>`:""}
              </div>
            </div>
          `}).join("")}
      </div>
    `;t.innerHTML=s}showCandidateDetails(e,t,a,s){let n=document.getElementById("candidate-drawer");n.classList.remove("hidden");let o=document.getElementById("candidate-content");o.innerHTML=`
      <div class="candidate-details">
        <div class="candidate-header">
          <button class="btn-close" aria-label="Close">\u2715</button>
          <h2>${e.name}</h2>
          <p class="candidate-id">${e.id}</p>
        </div>

        <div class="candidate-stage-info">
          <div class="stage-badge" data-stage="${e.currentStage}">
            ${this.stageName(e.currentStage)}
          </div>
          <div class="assessment-version">v${e.assessmentVersion}</div>
        </div>

        <div class="candidate-timeline">
          <h3>Timeline</h3>
          ${e.history.map(i=>`
            <div class="timeline-item">
              <span class="timeline-stage">${this.stageName(i.stage)}</span>
              <span class="timeline-date">${new Date(i.timestamp).toLocaleDateString()}</span>
            </div>
          `).join("")}
        </div>

        ${e.panel?`
          <div class="candidate-panel">
            <h3>Panel ${e.assessmentVersion>1?`(v${e.assessmentVersion})`:""}</h3>
            <div class="panel-members">
              ${e.panel.members.map(i=>`
                <div class="panel-member">
                  <div class="member-info">
                    <span class="member-name">${i.name}</span>
                    <span class="member-email">${i.email}</span>
                  </div>
                  <div class="member-score">
                    ${i.score?`<span class="score">${i.score}/5</span>`:'<span class="no-score">No score</span>'}
                  </div>
                  ${a.role==="coordinator"&&e.panelCanEdit?`
                    <button class="btn-remove-member" data-member-id="${i.id}">Remove</button>
                  `:""}
                </div>
              `).join("")}
            </div>
            ${e.panelCanEdit?`
              <div class="add-panel-member">
                <select id="panel-select">
                  <option value="">Add panel member...</option>
                  <option value="hiring@pellmoor.test">Ruth Aldane (Hiring Manager)</option>
                  <option value="panel1@pellmoor.test">Otis Barre</option>
                  <option value="panel2@pellmoor.test">Wren Foss</option>
                </select>
                <button class="btn btn-small" id="add-member-btn">Add</button>
              </div>
            `:""}
          </div>
        `:'<p class="empty">No panel assigned</p>'}

        ${e.currentStage==="interview"?`
          <div class="scoring-section">
            <h3>Score</h3>
            <input type="number" id="score-input" min="1" max="5" placeholder="Enter score (1-5)">
            <button class="btn btn-small" id="submit-score">Record Score</button>
          </div>
        `:""}

        <div class="candidate-actions">
          ${this.getAvailableActions(e,a).map(i=>`
            <button class="btn btn-action" data-action="${i.id}">
              ${i.label}
            </button>
          `).join("")}
        </div>

        <div class="candidate-notes">
          <h3>Notes</h3>
          <div class="notes-list">
            ${e.notes.map(i=>`
              <div class="note">
                <div class="note-header">
                  <span class="note-author">${i.author_name}</span>
                  <span class="note-date">${new Date(i.created_at).toLocaleDateString()}</span>
                </div>
                <div class="note-content">${this.escapeHtml(i.content)}</div>
              </div>
            `).join("")}
          </div>
          <div class="add-note-form">
            <textarea id="note-input" placeholder="Add a note..."></textarea>
            <button class="btn btn-small" id="add-note-btn">Add Note</button>
          </div>
        </div>
      </div>
    `,o.querySelector(".btn-close").addEventListener("click",()=>{n.classList.add("hidden")}),o.querySelectorAll("[data-action]").forEach(i=>{i.addEventListener("click",()=>{let h=i.dataset.action;this.handleCandidateAction(h,e,t,s)})}),document.getElementById("submit-score")?.addEventListener("click",()=>{let i=document.getElementById("score-input"),h=parseInt(i.value,10);h>=1&&h<=5&&s.recordScore(e.id,h)}),document.getElementById("add-note-btn")?.addEventListener("click",()=>{let i=document.getElementById("note-input");i.value.trim()&&s.addNote(e.id,i.value.trim())}),document.getElementById("add-member-btn")?.addEventListener("click",()=>{let i=document.getElementById("panel-select");i.value&&s.addPanelMember(e.id,i.value)}),o.querySelectorAll(".btn-remove-member").forEach(i=>{i.addEventListener("click",()=>{let h=i.dataset.memberId;s.removePanelMember(e.id,parseInt(h,10))})})}getAvailableActions(e,t){let a=[],s=e.currentStage;return t.role==="hiring manager"&&(s==="applied"&&a.push({id:"to-screening",label:"\u2192 Screening"}),s==="screening"&&(a.push({id:"to-interview",label:"\u2192 Interview"}),a.push({id:"reject",label:"\u2192 Rejected"})),s==="interview"&&(a.push({id:"to-offer",label:"\u2192 Offer"}),a.push({id:"to-screening",label:"\u2190 Back to Screening"}),a.push({id:"reject",label:"\u2192 Rejected"})),s==="offer"&&(a.push({id:"to-hired",label:"\u2192 Hired"}),a.push({id:"to-interview",label:"\u2190 Back to Interview"})),s==="hired"&&a.push({id:"to-offer",label:"\u2190 Back to Offer"})),s!=="rejected"&&s!=="withdrawn"&&a.push({id:"withdraw",label:"\u2192 Withdrawn"}),a}handleCandidateAction(e,t,a,s){let o={"to-screening":"screening","to-interview":"interview","to-offer":"offer","to-hired":"hired",reject:"rejected",withdraw:"withdrawn"}[e];o&&s.moveCandidate(a.code,t.id,o,a.revision)}escapeHtml(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}showError(e){this.showNotification(e,"error")}showSuccess(e){this.showNotification(e,"success")}showNotification(e,t){let a=document.createElement("div");a.className=`notification notification-${t}`,a.textContent=e,document.body.appendChild(a),setTimeout(()=>{a.classList.add("show")},10),setTimeout(()=>{a.classList.remove("show"),setTimeout(()=>a.remove(),300)},3e3)}};var p=class{constructor(){d(this,"api");d(this,"ui");d(this,"store");d(this,"currentUser",null);this.api=new v,this.store=new m,this.ui=new y(this)}async init(){let e=this.store.getToken();if(e)try{this.currentUser=await this.api.validateSession(e),this.showWorkspace();return}catch{this.store.clearToken()}this.showLoginPage()}async login(e,t){try{let a=await this.api.login(e,t);this.store.setToken(a.token),this.currentUser=a.user,this.showWorkspace()}catch(a){this.ui.showError(a.message||"Login failed")}}async logout(){try{let e=this.store.getToken();e&&await this.api.logout(e)}catch(e){console.error("Logout error:",e)}this.store.clearToken(),this.currentUser=null,this.showLoginPage()}showLoginPage(){this.ui.showLoginPage((e,t)=>this.login(e,t))}showWorkspace(){this.ui.showWorkspace(this.currentUser,()=>this.logout()),this.loadVacancies()}async loadVacancies(){try{let e=await this.api.getVacancies();this.store.setVacancies(e.vacancies),this.ui.updateVacanciesList(e.vacancies,t=>this.selectVacancy(t))}catch(e){this.ui.showError(e.message||"Failed to load vacancies")}}async selectVacancy(e){try{let t=await this.api.getVacancy(e);this.store.setCurrentVacancy(t.vacancy),this.ui.showVacancyDetails(t.vacancy,this.currentUser,this)}catch(t){this.ui.showError(t.message||"Failed to load vacancy")}}async selectCandidate(e){try{let t=this.store.getCurrentVacancy(),a=t.candidates.find(r=>r.id===e);if(!a)throw new Error("Candidate not found");let[s,n]=await Promise.all([this.api.getPanel(e),this.api.getNotes(e)]),o={...a,panel:s.panel,panelCanEdit:s.canEdit,assessmentVersion:s.assessmentVersion,notes:n.notes};this.ui.showCandidateDetails(o,t,this.currentUser,this)}catch(t){this.ui.showError(t.message||"Failed to load candidate")}}async moveCandidate(e,t,a,s){try{let n=await this.api.moveCandidate(e,t,a,s);await this.selectVacancy(e),this.ui.showSuccess("Candidate moved successfully")}catch(n){n.status===409?(this.ui.showError("Vacancy was updated. Please refresh and try again."),await this.selectVacancy(e)):this.ui.showError(n.message||"Failed to move candidate")}}async addCandidate(e,t){try{await this.api.addCandidate(e,t),await this.selectVacancy(e),this.ui.showSuccess("Candidate added successfully")}catch(a){this.ui.showError(a.message||"Failed to add candidate")}}async addNote(e,t){try{await this.api.addNote(e,t),this.ui.showSuccess("Note added");let a=this.store.getCurrentVacancy();a&&a.candidates.find(n=>n.id===e)&&await this.selectCandidate(e)}catch(a){this.ui.showError(a.message||"Failed to add note")}}async addPanelMember(e,t){try{let s=this.store.getCurrentVacancy().candidates.find(n=>n.id===e);await this.api.addPanelMember(e,t,s.revision),await this.selectCandidate(e),this.ui.showSuccess("Panel member added")}catch(a){a.status===409?(this.ui.showError("Candidate was updated. Refreshing..."),await this.selectCandidate(e)):this.ui.showError(a.message||"Failed to add panel member")}}async removePanelMember(e,t){try{let s=this.store.getCurrentVacancy().candidates.find(n=>n.id===e);await this.api.removePanelMember(e,t,s.revision),await this.selectCandidate(e),this.ui.showSuccess("Panel member removed")}catch(a){a.status===409?(this.ui.showError("Candidate was updated. Refreshing..."),await this.selectCandidate(e)):this.ui.showError(a.message||"Failed to remove panel member")}}async recordScore(e,t){try{await this.api.recordScore(e,t),await this.selectCandidate(e),this.ui.showSuccess("Score recorded")}catch(a){this.ui.showError(a.message||"Failed to record score")}}async previewBatchOffer(e,t,a){try{return await this.api.previewBatchOffer(e,t,a)}catch(s){throw s.status===409?new Error("Vacancy was updated. Please refresh and try again."):s}}async commitBatchOffer(e,t,a,s){try{let n=await this.api.commitBatchOffer(e,t,a,s);return await this.selectVacancy(e),n}catch(n){if(n.status===409){let o=n.response?.currentRevision;throw new Error(`Vacancy was updated. Current revision: ${o}. Please refresh and try again.`)}throw n}}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{new p().init()}):new p().init();})();

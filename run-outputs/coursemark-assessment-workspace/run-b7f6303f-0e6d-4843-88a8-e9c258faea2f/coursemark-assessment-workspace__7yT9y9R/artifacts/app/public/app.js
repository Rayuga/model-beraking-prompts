// Coursemark Frontend Application
(function() {
  'use strict';

  // Application State
  const state = {
    token: localStorage.getItem('coursemark_token') || null,
    user: null,
    course: { id: 'BIO-214', title: 'Ecology and Field Methods', revision: 0 },
    activeView: 'courses',
    gradebookSubview: 'gb-ledger',
    assessments: [],
    attempts: [],
    outcomes: null,
    auditEvents: [],
    isPending: false,
    activeModal: null,
    modalTriggerElement: null,
    batchReleasePreviewId: null
  };

  // Helper: Generate Random Operation ID
  function generateOperationId() {
    return 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  }

  // Helper: Show Notification Toast
  function showToast(message, type = 'info') {
    const region = document.getElementById('notification-region');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" aria-label="Dismiss" style="background:none;border:none;color:#fff;cursor:pointer;">&times;</button>`;
    
    toast.querySelector('button').onclick = () => toast.remove();
    region.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 4000);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // API Client with Idempotency & Revision Coordination
  async function apiCall(method, path, body = null, isWrite = false) {
    const headers = {
      'Accept': 'application/json'
    };

    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    let payload = body;
    if (isWrite) {
      const opId = generateOperationId();
      headers['X-Operation-Id'] = opId;
      headers['X-Expected-Revision'] = String(state.course.revision);

      payload = Object.assign({}, body || {}, {
        operation_id: opId,
        expected_revision: state.course.revision
      });
    }

    const options = {
      method: method.toUpperCase(),
      headers
    };

    if (payload) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(payload);
    }

    if (isWrite) {
      setSyncStatus('syncing', 'Saving changes...');
    }

    try {
      const response = await fetch(path, options);
      const data = await response.json().catch(() => ({}));

      // Update course revision if server returned one
      if (data && data.course_revision !== undefined) {
        state.course.revision = data.course_revision;
        updateHeaderStatus();
      }

      if (response.status === 401) {
        setSyncStatus('synced', 'Synchronized');
        handleUnauthorized();
        throw new Error(data.error || 'Session expired or unauthorized');
      }

      if (response.status === 409 || response.status === 412) {
        if (data.current_revision !== undefined) {
          state.course.revision = data.current_revision;
          updateHeaderStatus();
        }
        setSyncStatus('conflict', 'Conflict: revision updated');
        showConflictBanner(data.error || 'Another tab updated the course data.');
        // Refresh background data
        refreshWorkspaceData(false);
        const err = new Error(data.error || 'Concurrency conflict');
        err.status = response.status;
        err.data = data;
        throw err;
      }

      if (!response.ok) {
        setSyncStatus('synced', 'Synchronized');
        const err = new Error(data.error || `Request failed with status ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      setSyncStatus('synced', 'Synchronized');
      return data;
    } catch (err) {
      if (!err.status || (err.status !== 409 && err.status !== 412)) {
        setSyncStatus('synced', 'Synchronized');
      }
      throw err;
    }
  }

  function setSyncStatus(status, text) {
    const indicator = document.getElementById('sync-status-indicator');
    const label = document.getElementById('sync-status-text');
    if (!indicator || !label) return;

    indicator.className = `status-pill sync-pill sync-${status}`;
    label.textContent = text;
  }

  function showConflictBanner(msg) {
    const banner = document.getElementById('conflict-banner');
    const text = document.getElementById('conflict-message');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }

  window.dismissConflictBanner = function() {
    const banner = document.getElementById('conflict-banner');
    if (banner) banner.classList.add('hidden');
  };

  function updateHeaderStatus() {
    const revEl = document.getElementById('header-course-rev');
    if (revEl) revEl.textContent = `#${state.course.revision}`;

    const tagEl = document.getElementById('course-rev-tag');
    if (tagEl) tagEl.textContent = `Revision #${state.course.revision}`;
  }

  function handleUnauthorized() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('coursemark_token');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
  }

  // Modal Management with Accessible Focus Trap
  function openModal(modalId, triggerEl = null) {
    const modal = document.getElementById(modalId);
    const backdrop = document.getElementById('modal-backdrop');
    if (!modal) return;

    state.activeModal = modalId;
    state.modalTriggerElement = triggerEl || document.activeElement;

    backdrop.classList.remove('hidden');
    modal.classList.remove('hidden');

    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) {
      focusable[0].focus();
    }
  }

  function closeModal(modalId = null) {
    const targetId = modalId || state.activeModal;
    if (!targetId) return;

    const modal = document.getElementById(targetId);
    const backdrop = document.getElementById('modal-backdrop');

    if (modal) modal.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');

    if (state.modalTriggerElement && typeof state.modalTriggerElement.focus === 'function') {
      state.modalTriggerElement.focus();
    }

    state.activeModal = null;
    state.modalTriggerElement = null;
  }

  // Setup Global Modal Event Listeners
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeModal) {
      closeModal();
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal());
  });

  document.getElementById('modal-backdrop').addEventListener('click', () => closeModal());

  // -------------------------------------------------------------
  // Authentication Handlers
  // -------------------------------------------------------------
  const loginForm = document.getElementById('login-form');
  const authError = document.getElementById('auth-error');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      authError.textContent = 'Please enter both email and password.';
      authError.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const data = await apiCall('POST', '/api/auth/login', { email, password });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('coursemark_token', data.token);

      await initAuthenticatedApp();
    } catch (err) {
      authError.textContent = err.data?.error || err.message || 'Sign in failed. Check credentials.';
      authError.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Demo Quick-Sign-In buttons
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = 'Coursemark!2026';
      loginForm.dispatchEvent(new Event('submit'));
    });
  });

  // Sign Out Button
  document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
      await apiCall('POST', '/api/auth/logout');
    } catch (e) {
      console.warn('Logout API error:', e);
    }
    handleUnauthorized();
    showToast('Signed out of all active sessions.', 'info');
  });

  // Manual Refresh Button
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await refreshWorkspaceData(true);
    showToast('Workspace data refreshed.', 'info');
  });

  // -------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      switchView(view);
    });
  });

  function switchView(viewName) {
    state.activeView = viewName;
    navTabs.forEach(t => {
      const isCurrent = t.getAttribute('data-view') === viewName;
      t.classList.toggle('active', isCurrent);
      t.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      if (isCurrent) {
        t.setAttribute('aria-current', 'page');
      } else {
        t.removeAttribute('aria-current');
      }
    });

    document.querySelectorAll('.workspace-view').forEach(v => {
      v.classList.add('hidden');
    });

    const activeEl = document.getElementById(`view-${viewName}`);
    if (activeEl) {
      activeEl.classList.remove('hidden');
    }

    renderCurrentView();
  }

  function renderCurrentView() {
    if (state.activeView === 'courses') renderCoursesView();
    if (state.activeView === 'assessments') renderAssessmentsView();
    if (state.activeView === 'attempts') renderAttemptsView();
    if (state.activeView === 'gradebook') renderGradebookView();
    if (state.activeView === 'audit') renderAuditView();
  }

  // -------------------------------------------------------------
  // Data Fetching & Sync
  // -------------------------------------------------------------
  async function initAuthenticatedApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    // Fetch user & course
    const meData = await apiCall('GET', '/api/auth/me');
    state.user = meData.user;
    state.course = meData.course;

    document.getElementById('header-user-name').textContent = state.user.name;
    const roleEl = document.getElementById('header-user-role');
    roleEl.textContent = state.user.role.replace('_', ' ');
    roleEl.className = `badge badge-role badge-${state.user.role === 'teaching_assistant' ? 'ta' : state.user.role}`;

    updateHeaderStatus();

    // Toggle role-specific controls
    const isStaff = state.user.role === 'instructor' || state.user.role === 'teaching_assistant';
    const isInstructor = state.user.role === 'instructor';

    document.querySelectorAll('.staff-only').forEach(el => el.classList.toggle('hidden', !isStaff));
    document.querySelectorAll('.instructor-only').forEach(el => el.classList.toggle('hidden', !isInstructor));

    await refreshWorkspaceData(false);
    switchView('courses');
  }

  async function refreshWorkspaceData(render = true) {
    try {
      const [coursesData, assessmentsData, attemptsData] = await Promise.all([
        apiCall('GET', '/api/courses'),
        apiCall('GET', '/api/assessments'),
        apiCall('GET', '/api/attempts')
      ]);

      if (coursesData.courses?.length) {
        state.course = coursesData.courses[0];
        updateHeaderStatus();
      }
      state.assessments = assessmentsData.assessments || [];
      state.attempts = attemptsData.attempts || [];

      // If Instructor or Student, fetch outcomes
      if (state.user.role !== 'teaching_assistant') {
        try {
          const outcomesData = await apiCall('GET', '/api/outcomes');
          state.outcomes = outcomesData;
        } catch (e) {
          console.warn('Could not load outcomes:', e);
        }
      }

      // Fetch audit events
      try {
        const auditData = await apiCall('GET', '/api/audit');
        state.auditEvents = auditData.events || [];
      } catch (e) {
        console.warn('Could not load audit:', e);
      }

      if (render) {
        renderCurrentView();
      }
    } catch (err) {
      console.error('Failed refreshing workspace data:', err);
    }
  }

  // -------------------------------------------------------------
  // View 1: Courses
  // -------------------------------------------------------------
  function renderCoursesView() {
    document.getElementById('course-title').textContent = state.course.title;
    document.getElementById('course-instructor').textContent = state.course.instructor_id === 'user_1' ? 'Ada Mensah' : state.course.instructor_id;

    const tbody = document.getElementById('roster-table-body');
    tbody.innerHTML = '';

    const enrollments = state.course.enrollments || [];
    for (const e of enrollments) {
      const tr = document.createElement('tr');
      let accText = 'None';
      if (e.user_id === 'user_3') accText = '+15 min extra duration';
      if (e.user_id === 'user_4') accText = '+60 min deadline extension';

      tr.innerHTML = `
        <td><strong>${escapeHtml(e.name)}</strong></td>
        <td>${escapeHtml(e.email)}</td>
        <td><span class="badge badge-role badge-${e.role === 'teaching_assistant' ? 'ta' : e.role}">${escapeHtml(e.role.replace('_', ' '))}</span></td>
        <td>${escapeHtml(accText)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  // -------------------------------------------------------------
  // View 2: Assessments
  // -------------------------------------------------------------
  function renderAssessmentsView() {
    const list = document.getElementById('assessments-list');
    list.innerHTML = '';

    if (state.assessments.length === 0) {
      list.innerHTML = '<p class="text-muted">No assessments available.</p>';
      return;
    }

    const isInstructor = state.user.role === 'instructor';
    const isStudent = state.user.role === 'student';

    for (const a of state.assessments) {
      const card = document.createElement('div');
      card.className = `card assessment-card status-${a.status}`;

      const statusBadge = `<span class="badge badge-status-${a.status}">${escapeHtml(a.status.toUpperCase())}</span>`;
      
      let studentInfoHtml = '';
      if (isStudent && a.student_info) {
        const sInfo = a.student_info;
        studentInfoHtml = `
          <div class="mt-2 p-2" style="background:#f8fafc; border-radius:4px; font-size:0.8125rem;">
            <div><strong>Effective Due:</strong> ${escapeHtml(formatDate(sInfo.effective_due_at))}</div>
            <div><strong>Effective Duration:</strong> ${sInfo.effective_duration_minutes} min (${sInfo.extra_time_minutes > 0 ? '+' + sInfo.extra_time_minutes + 'm extra' : 'standard'})</div>
            <div><strong>Attempts Used:</strong> ${sInfo.attempts_used} / ${a.max_attempts}</div>
          </div>
        `;
      }

      let actionsHtml = '';
      if (isStudent && a.student_info) {
        const sInfo = a.student_info;
        if (sInfo.has_active_attempt) {
          const activeAtt = sInfo.attempts.find(att => att.status === 'in_progress');
          actionsHtml += `<button type="button" class="btn btn-primary btn-sm" onclick="window.openAttemptModal('${activeAtt?.id}')">Resume Active Attempt</button>`;
        } else if (sInfo.can_start) {
          actionsHtml += `<button type="button" class="btn btn-primary btn-sm" onclick="window.startNewAttempt('${a.id}')">Start Attempt</button>`;
        } else if (sInfo.attempts.length > 0) {
          const lastAtt = sInfo.attempts[sInfo.attempts.length - 1];
          actionsHtml += `<button type="button" class="btn btn-secondary btn-sm" onclick="window.openAttemptModal('${lastAtt.id}')">View Attempt (${lastAtt.status})</button>`;
        }
      }

      if (isInstructor && a.status === 'draft') {
        actionsHtml += `
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.openAddItemModal('${a.id}')">+ Add Question</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.publishAssessment('${a.id}')">Publish</button>
        `;
      }

      card.innerHTML = `
        <div>
          <div class="assessment-card-header">
            <div>
              <h3>${escapeHtml(a.title)}</h3>
              <small class="text-muted">ID: ${escapeHtml(a.id)} | Weight: ${a.weight_percent}%</small>
            </div>
            ${statusBadge}
          </div>
          <div class="assessment-meta-grid">
            <div><strong>Opens:</strong> ${escapeHtml(formatDate(a.opens_at))}</div>
            <div><strong>Due:</strong> ${escapeHtml(formatDate(a.due_at))}</div>
            <div><strong>Duration:</strong> ${a.duration_minutes} mins</div>
            <div><strong>Questions:</strong> ${a.item_count} (${a.total_points} pts)</div>
          </div>
          ${studentInfoHtml}
        </div>
        <div class="assessment-actions">
          ${actionsHtml}
        </div>
      `;
      list.appendChild(card);
    }
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    } catch (e) {
      return isoStr;
    }
  }

  // -------------------------------------------------------------
  // View 3: Attempts
  // -------------------------------------------------------------
  function renderAttemptsView() {
    const tbody = document.getElementById('attempts-table-body');
    tbody.innerHTML = '';

    const filterStatus = document.getElementById('attempts-filter-status').value;
    let filtered = state.attempts;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-muted text-center">No attempts match the current filter.</td></tr>';
      return;
    }

    const isStaff = state.user.role === 'instructor' || state.user.role === 'teaching_assistant';

    for (const att of filtered) {
      const tr = document.createElement('tr');

      const isReleased = att.feedback_status === 'released';
      let scoreDisplay = '<span class="text-muted">Pending release</span>';
      if (isReleased) {
        scoreDisplay = `<strong>${att.total_score} pts</strong>`;
      } else if (isStaff) {
        scoreDisplay = `<span class="text-muted">${att.total_score !== null ? att.total_score + ' pts (Private)' : 'Ungraded'}</span>`;
      }

      let actionsHtml = `<button type="button" class="btn btn-secondary btn-sm" onclick="window.openAttemptModal('${att.id}')">View</button>`;
      if (isStaff && (att.status === 'submitted' || att.status === 'graded') && !isReleased) {
        actionsHtml += ` <button type="button" class="btn btn-primary btn-sm ml-2" onclick="window.openAttemptModal('${att.id}')">Grade</button>`;
      }

      tr.innerHTML = `
        <td><strong>${escapeHtml(att.id)}</strong></td>
        <td>${escapeHtml(att.student_name || att.student_id)}</td>
        <td>${escapeHtml(att.assessment_title || att.assessment_id)}</td>
        <td><span class="badge badge-info">${escapeHtml(att.status.toUpperCase())}</span></td>
        <td>${escapeHtml(formatDate(att.started_at))}</td>
        <td>${escapeHtml(formatDate(att.submitted_at))}</td>
        <td><span class="badge ${isReleased ? 'badge-released' : 'badge-pending'}">${escapeHtml(att.feedback_status.toUpperCase())}</span></td>
        <td>${scoreDisplay}</td>
        <td>${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  document.getElementById('attempts-filter-status').addEventListener('change', () => {
    renderAttemptsView();
  });

  // -------------------------------------------------------------
  // View 4: Gradebook
  // -------------------------------------------------------------
  // Subnav tabs
  document.querySelectorAll('.subnav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subnav-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const subview = tab.getAttribute('data-subview');
      state.gradebookSubview = subview;

      document.querySelectorAll('.gradebook-subview').forEach(v => v.classList.add('hidden'));
      const activeEl = document.getElementById(`${subview}-subview`);
      if (activeEl) activeEl.classList.remove('hidden');

      renderGradebookView();
    });
  });

  function renderGradebookView() {
    if (state.gradebookSubview === 'gb-ledger') {
      renderOutcomeLedger();
    } else if (state.gradebookSubview === 'gb-worksheet') {
      renderWorksheet();
    } else if (state.gradebookSubview === 'gb-release') {
      renderBatchRelease();
    }
  }

  // Outcome Ledger
  function renderOutcomeLedger() {
    const container = document.getElementById('ledger-content-container');
    if (!state.outcomes || !state.outcomes.ledger) {
      container.innerHTML = '<p class="text-muted">Loading outcome data...</p>';
      return;
    }

    const isInstructor = state.user.role === 'instructor';
    const isStudent = state.user.role === 'student';

    if (isStudent) {
      // Student personal view
      const myRow = state.outcomes.ledger[0];
      if (!myRow) {
        container.innerHTML = '<p class="text-muted">No grade records found.</p>';
        return;
      }

      let finalScoreText = 'Pending / Unavailable';
      if (myRow.final_status === 'calculated' && myRow.final_percentage !== null) {
        finalScoreText = `${myRow.final_percentage.toFixed(2)}%`;
      }

      let tableRows = '';
      for (const cell of myRow.assessments) {
        let scoreText = 'Pending';
        if (cell.state === 'released') {
          scoreText = `${cell.awarded_points} / ${cell.max_points} pts`;
        } else if (cell.state === 'excused') {
          scoreText = `Excused (${escapeHtml(cell.excuse_reason)})`;
        } else if (cell.state === 'missing') {
          scoreText = 'Missing';
        } else if (cell.state === 'unweighted') {
          scoreText = 'Unweighted (0%)';
        }

        tableRows += `
          <tr>
            <td><strong>${escapeHtml(cell.assessment_title)}</strong></td>
            <td>${cell.weight.toFixed(2)}%</td>
            <td><span class="badge badge-${cell.state}">${cell.state.toUpperCase()}</span></td>
            <td>${scoreText}</td>
          </tr>
        `;
      }

      container.innerHTML = `
        <div class="card mb-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h3>Final Weighted Outcome</h3>
              <p class="text-muted">${escapeHtml(myRow.explanation)}</p>
            </div>
            <div style="font-size: 1.75rem; font-weight: 700; color: var(--color-primary);">
              ${finalScoreText}
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Assessment</th>
                  <th scope="col">Policy Weight</th>
                  <th scope="col">Status</th>
                  <th scope="col">Awarded Score</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // Instructor full ledger
    const searchVal = document.getElementById('student-search-input')?.value.toLowerCase().trim() || '';
    const filteredLedger = state.outcomes.ledger.filter(row => {
      if (!searchVal) return true;
      return row.name.toLowerCase().includes(searchVal) || row.email.toLowerCase().includes(searchVal);
    });

    const assessmentsHeaders = state.outcomes.assessments.map(a => `
      <th scope="col" style="min-width: 140px;">
        <div>${escapeHtml(a.title)}</div>
        <small class="text-muted">${a.weight.toFixed(2)}% | ${a.max_points} pts</small>
      </th>
    `).join('');

    let rowsHtml = '';
    for (const row of filteredLedger) {
      let finalDisplay = '<span class="text-muted">Pending</span>';
      if (row.final_status === 'calculated' && row.final_percentage !== null) {
        finalDisplay = `<strong style="color: var(--color-primary);">${row.final_percentage.toFixed(2)}%</strong>`;
      }

      const cellsHtml = row.assessments.map(cell => {
        let cellContent = '';
        if (cell.state === 'released') {
          cellContent = `<strong>${cell.awarded_points}/${cell.max_points}</strong> <span class="badge badge-released">Released</span>`;
        } else if (cell.state === 'excused') {
          cellContent = `<span class="badge badge-excused" title="${escapeHtml(cell.excuse_reason)}">Excused</span>`;
        } else if (cell.state === 'missing') {
          cellContent = `<span class="badge badge-missing">Missing</span>`;
        } else if (cell.state === 'unweighted') {
          cellContent = `<span class="badge badge-unweighted">0% Wt</span>`;
        } else {
          cellContent = `<span class="badge badge-pending">Pending</span>`;
        }

        const excuseBtn = `
          <button type="button" class="btn btn-sm btn-secondary mt-1" style="font-size:0.7rem; padding:2px 6px; min-height:24px;"
            onclick="window.openExceptionModal('${row.student_id}', '${cell.assessment_id}', '${escapeHtml(row.name)}', '${escapeHtml(cell.assessment_title)}', ${cell.excused})">
            ${cell.excused ? 'Restore' : 'Excuse'}
          </button>
        `;

        return `
          <td>
            <div class="outcome-cell">
              ${cellContent}
              ${excuseBtn}
            </div>
          </td>
        `;
      }).join('');

      rowsHtml += `
        <tr>
          <td>
            <strong>${escapeHtml(row.name)}</strong>
            <div class="text-muted" style="font-size:0.75rem;">${escapeHtml(row.email)}</div>
          </td>
          ${cellsHtml}
          <td>${finalDisplay}</td>
        </tr>
      `;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col" style="min-width: 160px;">Student</th>
              ${assessmentsHeaders}
              <th scope="col" style="min-width: 110px;">Final Grade</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('student-search-input')?.addEventListener('input', () => {
    renderOutcomeLedger();
  });

  // Atomic Worksheet
  async function renderWorksheet() {
    const tbody = document.getElementById('worksheet-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Loading worksheet data...</td></tr>';

    const isStaff = state.user.role === 'instructor' || state.user.role === 'teaching_assistant';
    if (!isStaff) return;

    // We fetch detailed attempts that are submitted or graded but unreleased
    const unreleased = state.attempts.filter(a => (a.status === 'submitted' || a.status === 'graded') && a.feedback_status !== 'released');
    
    if (unreleased.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No unreleased attempts awaiting worksheet grading.</td></tr>';
      return;
    }

    // Load full details for these attempts
    const rowsData = [];
    for (const att of unreleased) {
      if (state.user.role === 'teaching_assistant' && att.assigned_grader_id !== state.user.id) {
        continue;
      }
      try {
        const detail = await apiCall('GET', `/api/attempts/${att.id}`);
        const attempt = detail.attempt;
        for (const item of attempt.items) {
          if (item.kind === 'written' && item.rubric_criteria) {
            for (const rc of item.rubric_criteria) {
              rowsData.push({
                attempt_id: attempt.id,
                student_name: attempt.student_name,
                assessment_title: attempt.assessment_title,
                criterion_id: rc.id,
                criterion_label: rc.label,
                max_points: rc.max_points,
                current_score: rc.grade ? rc.grade.score : '',
                current_feedback: rc.grade ? rc.grade.feedback : ''
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Error loading attempt ${att.id}:`, e);
      }
    }

    if (rowsData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No rubric criteria available for worksheet grading.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    for (let i = 0; i < rowsData.length; i++) {
      const r = rowsData[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input type="checkbox" class="ws-row-check" data-idx="${i}" aria-label="Select row ${r.attempt_id} ${r.criterion_id}">
        </td>
        <td><strong>${escapeHtml(r.attempt_id)}</strong></td>
        <td>${escapeHtml(r.student_name)}</td>
        <td>${escapeHtml(r.assessment_title)}</td>
        <td>${escapeHtml(r.criterion_label)} <span class="badge badge-neutral">Max: ${r.max_points}</span></td>
        <td>
          <input type="number" class="input-control ws-score" data-idx="${i}" min="0" max="${r.max_points}" step="any" value="${r.current_score}" placeholder="0 - ${r.max_points}">
        </td>
        <td>
          <input type="text" class="input-control ws-feedback" data-idx="${i}" value="${escapeHtml(r.current_feedback || '')}" placeholder="Optional feedback...">
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Attach row change listeners
    window.currentWorksheetRowsData = rowsData;
    updateWorksheetSelectionCount();

    tbody.querySelectorAll('.ws-row-check').forEach(cb => {
      cb.addEventListener('change', updateWorksheetSelectionCount);
    });
  }

  function updateWorksheetSelectionCount() {
    const selected = document.querySelectorAll('.ws-row-check:checked');
    const btn = document.getElementById('btn-save-worksheet');
    const note = document.getElementById('worksheet-status-note');

    btn.disabled = selected.length === 0;
    note.textContent = `${selected.length} row(s) selected`;
  }

  document.getElementById('worksheet-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const checked = Array.from(document.querySelectorAll('.ws-row-check:checked'));
    if (checked.length === 0) return;

    const rowsPayload = [];
    for (const cb of checked) {
      const idx = Number(cb.getAttribute('data-idx'));
      const rData = window.currentWorksheetRowsData[idx];
      const scoreInput = document.querySelector(`.ws-score[data-idx="${idx}"]`);
      const feedbackInput = document.querySelector(`.ws-feedback[data-idx="${idx}"]`);

      const scoreVal = scoreInput.value.trim();
      if (scoreVal === '') {
        showToast(`Please enter a score for attempt ${rData.attempt_id} criterion ${rData.criterion_id}`, 'error');
        scoreInput.focus();
        return;
      }

      rowsPayload.push({
        attempt_id: rData.attempt_id,
        criterion_id: rData.criterion_id,
        score: Number(scoreVal),
        feedback: feedbackInput.value.trim()
      });
    }

    const btn = document.getElementById('btn-save-worksheet');
    btn.disabled = true;
    btn.textContent = 'Saving Worksheet...';

    try {
      await apiCall('POST', '/api/grading/worksheet', { rows: rowsPayload }, true);
      showToast('Worksheet grades saved successfully!', 'success');
      await refreshWorkspaceData(true);
      renderWorksheet();
    } catch (err) {
      showToast(err.data?.error || err.message || 'Worksheet save failed', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Selected Worksheet Rows';
    }
  });

  // Batch Release
  function renderBatchRelease() {
    const tbody = document.getElementById('release-table-body');
    tbody.innerHTML = '';

    const gradedUnreleased = state.attempts.filter(a => a.status === 'graded' && a.feedback_status !== 'released');
    if (gradedUnreleased.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted">No fully graded unreleased attempts available for release.</td></tr>';
      document.getElementById('btn-preview-batch-release').disabled = true;
      return;
    }

    for (const att of gradedUnreleased) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input type="checkbox" class="release-item-check" value="${att.id}" aria-label="Select attempt ${att.id}">
        </td>
        <td><strong>${escapeHtml(att.id)}</strong></td>
        <td>${escapeHtml(att.student_name)} (${escapeHtml(att.student_email)})</td>
        <td>${escapeHtml(att.assessment_title)}</td>
        <td>${att.objective_score} pts</td>
        <td>${att.rubric_score} pts</td>
        <td><strong>${att.total_score} pts</strong></td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.releaseSingleAttempt('${att.id}')">Release Single</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    const selectAll = document.getElementById('release-select-all');
    selectAll.checked = false;
    selectAll.onchange = () => {
      document.querySelectorAll('.release-item-check').forEach(cb => {
        cb.checked = selectAll.checked;
      });
      updateBatchReleaseCount();
    };

    tbody.querySelectorAll('.release-item-check').forEach(cb => {
      cb.onchange = updateBatchReleaseCount;
    });

    updateBatchReleaseCount();
  }

  function updateBatchReleaseCount() {
    const checked = document.querySelectorAll('.release-item-check:checked');
    const btn = document.getElementById('btn-preview-batch-release');
    btn.disabled = checked.length === 0;
    btn.textContent = `Preview Selected for Release (${checked.length} selected)`;
  }

  document.getElementById('btn-preview-batch-release')?.addEventListener('click', async () => {
    const checked = Array.from(document.querySelectorAll('.release-item-check:checked')).map(cb => cb.value);
    if (checked.length === 0) return;

    try {
      const data = await apiCall('POST', '/api/release/preview', { attempt_ids: checked });
      state.batchReleasePreviewId = data.preview_id;

      const previewTbody = document.getElementById('release-preview-table-body');
      previewTbody.innerHTML = '';

      for (const item of data.items) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(item.attempt_id)}</strong></td>
          <td>${escapeHtml(item.student_name)}</td>
          <td>${escapeHtml(item.student_email)}</td>
          <td>${escapeHtml(item.assessment_title)}</td>
          <td>${item.objective_score} pts</td>
          <td>${item.rubric_score} pts</td>
          <td><strong>${item.total_score} / ${item.max_score} pts</strong></td>
        `;
        previewTbody.appendChild(tr);
      }

      openModal('modal-release-preview', document.getElementById('btn-preview-batch-release'));
    } catch (err) {
      showToast(err.data?.error || err.message || 'Failed to generate preview', 'error');
    }
  });

  document.getElementById('btn-confirm-batch-release')?.addEventListener('click', async () => {
    if (!state.batchReleasePreviewId) return;

    const btn = document.getElementById('btn-confirm-batch-release');
    btn.disabled = true;
    btn.textContent = 'Committing Release...';

    try {
      const data = await apiCall('POST', '/api/release/commit', { preview_id: state.batchReleasePreviewId }, true);
      showToast(`Successfully released ${data.released_count} attempt(s)!`, 'success');
      closeModal('modal-release-preview');
      await refreshWorkspaceData(true);
      renderBatchRelease();
    } catch (err) {
      const errEl = document.getElementById('release-preview-error');
      errEl.textContent = err.data?.error || err.message || 'Release commit failed';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm & Commit Release';
    }
  });

  window.releaseSingleAttempt = async function(attemptId) {
    if (!confirm(`Release grades and feedback for attempt ${attemptId}?`)) return;

    try {
      await apiCall('POST', '/api/release/single', { attempt_id: attemptId }, true);
      showToast(`Attempt ${attemptId} released successfully!`, 'success');
      await refreshWorkspaceData(true);
      renderBatchRelease();
    } catch (err) {
      showToast(err.data?.error || err.message || 'Release failed', 'error');
    }
  };

  // -------------------------------------------------------------
  // View 5: Audit Log
  // -------------------------------------------------------------
  function renderAuditView() {
    const tbody = document.getElementById('audit-table-body');
    tbody.innerHTML = '';

    if (state.auditEvents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No audit events recorded.</td></tr>';
      return;
    }

    for (const ev of state.auditEvents) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${ev.id}</strong></td>
        <td>${escapeHtml(formatDate(ev.timestamp))}</td>
        <td><span class="badge badge-info">${escapeHtml(ev.action)}</span></td>
        <td>${escapeHtml(ev.actor_name || ev.actor_id || 'System')}</td>
        <td>${escapeHtml(ev.target_type || '-')}: ${escapeHtml(ev.target_id || '-')}</td>
        <td>${escapeHtml(ev.details)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  // -------------------------------------------------------------
  // Assessment Creation Modal Handlers
  // -------------------------------------------------------------
  document.getElementById('btn-open-create-assessment')?.addEventListener('click', () => {
    document.getElementById('create-assessment-error').classList.add('hidden');
    document.getElementById('create-assessment-form').reset();
    openModal('modal-create-assessment', document.getElementById('btn-open-create-assessment'));
  });

  document.getElementById('create-assessment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('create-assessment-error');
    errEl.classList.add('hidden');

    const title = document.getElementById('create-ass-title').value.trim();
    const opens_at = document.getElementById('create-ass-opens').value.trim();
    const due_at = document.getElementById('create-ass-due').value.trim();
    const duration_minutes = Number(document.getElementById('create-ass-duration').value);
    const max_attempts = Number(document.getElementById('create-ass-attempts').value);

    const btn = document.getElementById('btn-submit-create-assessment');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await apiCall('POST', '/api/assessments', {
        title, opens_at, due_at, duration_minutes, max_attempts
      }, true);
      showToast('Draft assessment created!', 'success');
      closeModal('modal-create-assessment');
      await refreshWorkspaceData(true);
    } catch (err) {
      errEl.textContent = err.data?.error || err.message || 'Creation failed';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Draft';
    }
  });

  // -------------------------------------------------------------
  // Add Question Modal Handlers
  // -------------------------------------------------------------
  window.openAddItemModal = function(assessmentId) {
    document.getElementById('add-item-error').classList.add('hidden');
    document.getElementById('add-item-form').reset();
    document.getElementById('add-item-assessment-id').value = assessmentId;
    document.getElementById('add-item-kind').value = 'multiple_choice';
    document.getElementById('mc-fields-container').classList.remove('hidden');
    document.getElementById('written-fields-container').classList.add('hidden');

    openModal('modal-add-item');
  };

  document.getElementById('add-item-kind')?.addEventListener('change', (e) => {
    const isMc = e.target.value === 'multiple_choice';
    document.getElementById('mc-fields-container').classList.toggle('hidden', !isMc);
    document.getElementById('written-fields-container').classList.toggle('hidden', isMc);
  });

  document.getElementById('btn-add-mc-option')?.addEventListener('click', () => {
    const container = document.getElementById('mc-options-list');
    const count = container.querySelectorAll('.option-row').length + 1;
    const row = document.createElement('div');
    row.className = 'option-row';
    row.innerHTML = `<input type="text" class="input-control mc-option-input" placeholder="Option ${count}" required>`;
    container.appendChild(row);
  });

  document.getElementById('btn-add-rc-criterion')?.addEventListener('click', () => {
    const container = document.getElementById('rubric-criteria-list');
    const row = document.createElement('div');
    row.className = 'rubric-row form-row';
    row.innerHTML = `
      <div class="col" style="flex: 2;">
        <input type="text" class="input-control rc-label-input" placeholder="Criterion label" required>
      </div>
      <div class="col" style="flex: 1;">
        <input type="number" class="input-control rc-max-input" placeholder="Max Pts" min="1" step="any" required>
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById('add-item-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('add-item-error');
    errEl.classList.add('hidden');

    const assessmentId = document.getElementById('add-item-assessment-id').value;
    const kind = document.getElementById('add-item-kind').value;
    const prompt = document.getElementById('add-item-prompt').value.trim();
    const points = Number(document.getElementById('add-item-points').value);

    let payload = { kind, prompt, points };

    if (kind === 'multiple_choice') {
      const options = Array.from(document.querySelectorAll('.mc-option-input'))
        .map(i => i.value.trim())
        .filter(o => o.length > 0);
      const answer = document.getElementById('add-item-answer').value.trim();
      payload.options = options;
      payload.answer = answer;
    } else {
      const criteria = [];
      const rows = document.querySelectorAll('#rubric-criteria-list .rubric-row');
      rows.forEach(r => {
        const label = r.querySelector('.rc-label-input')?.value.trim();
        const maxPts = Number(r.querySelector('.rc-max-input')?.value);
        if (label && maxPts) {
          criteria.push({ label, max_points: maxPts });
        }
      });
      payload.rubric_criteria = criteria;
    }

    const btn = document.getElementById('btn-submit-add-item');
    btn.disabled = true;
    btn.textContent = 'Adding Question...';

    try {
      await apiCall('POST', `/api/assessments/${assessmentId}/items`, payload, true);
      showToast('Question added successfully!', 'success');
      closeModal('modal-add-item');
      await refreshWorkspaceData(true);
    } catch (err) {
      errEl.textContent = err.data?.error || err.message || 'Failed to add question';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Question';
    }
  });

  // Publish Assessment Handler
  window.publishAssessment = async function(assessmentId) {
    if (!confirm(`Are you sure you want to publish assessment ${assessmentId}? Once published, it cannot accept further questions.`)) return;

    try {
      await apiCall('POST', `/api/assessments/${assessmentId}/publish`, {}, true);
      showToast('Assessment published successfully!', 'success');
      await refreshWorkspaceData(true);
    } catch (err) {
      showToast(err.data?.error || err.message || 'Publish failed', 'error');
    }
  };

  // -------------------------------------------------------------
  // Policy Weighting Modal Handlers
  // -------------------------------------------------------------
  document.getElementById('btn-open-policy-modal')?.addEventListener('click', () => {
    if (!state.outcomes) return;

    const list = document.getElementById('policy-assessments-list');
    list.innerHTML = '';

    for (const a of state.outcomes.assessments) {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group form-row align-items-center mb-2';
      formGroup.innerHTML = `
        <div class="col" style="flex: 2;">
          <label><strong>${escapeHtml(a.title)}</strong> (${escapeHtml(a.id)})</label>
        </div>
        <div class="col" style="flex: 1;">
          <input type="number" class="input-control policy-weight-input" data-id="${a.id}" value="${a.weight}" min="0" max="100" step="any" required>
        </div>
      `;
      list.appendChild(formGroup);
    }

    updatePolicyTotalSum();
    list.querySelectorAll('.policy-weight-input').forEach(input => {
      input.addEventListener('input', updatePolicyTotalSum);
    });

    document.getElementById('policy-error').classList.add('hidden');
    openModal('modal-policy', document.getElementById('btn-open-policy-modal'));
  });

  function updatePolicyTotalSum() {
    const inputs = document.querySelectorAll('.policy-weight-input');
    let sum = 0;
    inputs.forEach(i => {
      const val = parseFloat(i.value) || 0;
      sum += val;
    });
    const totalEl = document.getElementById('policy-total-sum');
    if (totalEl) {
      totalEl.textContent = `${sum.toFixed(2)}%`;
      totalEl.style.color = Math.abs(sum - 100) < 0.001 ? 'var(--color-success)' : 'var(--color-danger)';
    }
  }

  document.getElementById('policy-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('policy-error');
    errEl.classList.add('hidden');

    const weights = {};
    document.querySelectorAll('.policy-weight-input').forEach(i => {
      weights[i.getAttribute('data-id')] = Number(i.value);
    });

    const btn = document.getElementById('btn-submit-policy');
    btn.disabled = true;
    btn.textContent = 'Saving Policy...';

    try {
      await apiCall('POST', '/api/policy', { weights }, true);
      showToast('Outcome weighting policy updated!', 'success');
      closeModal('modal-policy');
      await refreshWorkspaceData(true);
    } catch (err) {
      errEl.textContent = err.data?.error || err.message || 'Policy update failed';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Policy';
    }
  });

  // -------------------------------------------------------------
  // Student Exception Modal Handlers
  // -------------------------------------------------------------
  window.openExceptionModal = function(studentId, assessmentId, studentName, assessmentTitle, isCurrentlyExcused) {
    document.getElementById('exception-error').classList.add('hidden');
    document.getElementById('exception-student-id').value = studentId;
    document.getElementById('exception-assessment-id').value = assessmentId;
    document.getElementById('exception-target-info').innerHTML = `
      Student: <strong>${escapeHtml(studentName)}</strong><br>
      Assessment: <strong>${escapeHtml(assessmentTitle)}</strong>
    `;

    const actionSelect = document.getElementById('exception-action');
    actionSelect.value = isCurrentlyExcused ? 'restore' : 'excuse';

    const reasonGroup = document.getElementById('exception-reason-group');
    reasonGroup.style.display = isCurrentlyExcused ? 'none' : 'block';

    actionSelect.onchange = () => {
      reasonGroup.style.display = actionSelect.value === 'excuse' ? 'block' : 'none';
    };

    openModal('modal-exception');
  };

  document.getElementById('exception-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('exception-error');
    errEl.classList.add('hidden');

    const student_id = document.getElementById('exception-student-id').value;
    const assessment_id = document.getElementById('exception-assessment-id').value;
    const action = document.getElementById('exception-action').value;
    const reason = document.getElementById('exception-reason').value.trim();

    const isExcused = action === 'excuse';
    if (isExcused && !reason) {
      errEl.textContent = 'A reason is required when excusing an assessment.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btn-submit-exception');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      await apiCall('POST', '/api/exceptions', {
        student_id, assessment_id, excused: isExcused, reason
      }, true);
      showToast('Student exception updated successfully!', 'success');
      closeModal('modal-exception');
      await refreshWorkspaceData(true);
    } catch (err) {
      errEl.textContent = err.data?.error || err.message || 'Failed to update exception';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Exception';
    }
  });

  // -------------------------------------------------------------
  // Attempt Taking / Viewing / Single Grading Modal
  // -------------------------------------------------------------
  window.startNewAttempt = async function(assessmentId) {
    if (!confirm('Start your timed attempt now? The timer begins immediately.')) return;

    try {
      const data = await apiCall('POST', '/api/attempts/start', { assessment_id: assessmentId }, true);
      showToast('Attempt started!', 'success');
      await refreshWorkspaceData(false);
      window.openAttemptModal(data.attempt.id);
    } catch (err) {
      showToast(err.data?.error || err.message || 'Could not start attempt', 'error');
    }
  };

  window.openAttemptModal = async function(attemptId) {
    const errEl = document.getElementById('attempt-modal-error');
    errEl.classList.add('hidden');

    try {
      const data = await apiCall('GET', `/api/attempts/${attemptId}`);
      const attempt = data.attempt;

      document.getElementById('modal-attempt-title').textContent = attempt.assessment_title;
      document.getElementById('modal-attempt-subtitle').textContent = `Attempt ID: ${attempt.id} | Student: ${attempt.student_name}`;

      const infoBox = document.getElementById('attempt-info-box');
      const isStudent = state.user.role === 'student';
      const isStaff = state.user.role === 'instructor' || state.user.role === 'teaching_assistant';
      const isInProgress = attempt.status === 'in_progress';
      const isReleased = attempt.feedback_status === 'released';

      let statusInfoHtml = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>Status:</strong> <span class="badge badge-info">${attempt.status.toUpperCase()}</span>
            <span class="badge ${isReleased ? 'badge-released' : 'badge-pending'} ml-2">${attempt.feedback_status.toUpperCase()}</span>
          </div>
          <div>
            <strong>Started:</strong> ${formatDate(attempt.started_at)}
          </div>
        </div>
      `;

      if (isInProgress && attempt.expiry_info) {
        statusInfoHtml += `
          <div class="mt-2 text-muted">
            <strong>Expires At:</strong> ${formatDate(attempt.expiry_info.expiresAt)}
            (${attempt.expiry_info.adjustedDurationMinutes} min total duration)
          </div>
        `;
      }

      if (isReleased) {
        statusInfoHtml += `
          <div class="mt-2" style="font-size:1.1rem; color:var(--color-success);">
            <strong>Awarded Total:</strong> ${attempt.total_score} pts
          </div>
        `;
      }

      infoBox.innerHTML = statusInfoHtml;

      // Render Items
      const itemsContainer = document.getElementById('attempt-items-container');
      itemsContainer.innerHTML = '';

      for (let i = 0; i < attempt.items.length; i++) {
        const item = attempt.items[i];
        const itemCard = document.createElement('div');
        itemCard.className = 'card mb-3';

        let contentHtml = `
          <div class="d-flex justify-content-between mb-2">
            <strong>Question ${i + 1} (${item.points} pts)</strong>
            <span class="badge badge-neutral">${item.kind === 'multiple_choice' ? 'Multiple Choice' : 'Written'}</span>
          </div>
          <p class="mb-3">${escapeHtml(item.prompt)}</p>
        `;

        if (item.kind === 'multiple_choice') {
          const optionsHtml = (item.options || []).map(opt => {
            const isChecked = item.student_answer === opt;
            const disabledAttr = !isInProgress || !isStudent ? 'disabled' : '';
            return `
              <div class="form-check mb-2">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                  <input type="radio" name="item_ans_${item.id}" value="${escapeHtml(opt)}" ${isChecked ? 'checked' : ''} ${disabledAttr} class="attempt-ans-input" data-item-id="${item.id}">
                  <span>${escapeHtml(opt)}</span>
                </label>
              </div>
            `;
          }).join('');
          contentHtml += `<div>${optionsHtml}</div>`;
        } else if (item.kind === 'written') {
          const disabledAttr = !isInProgress || !isStudent ? 'readonly' : '';
          contentHtml += `
            <div class="form-group">
              <label for="written_ans_${item.id}">Your Answer</label>
              <textarea id="written_ans_${item.id}" class="input-control attempt-ans-input" data-item-id="${item.id}" ${disabledAttr} placeholder="Write your answer here...">${escapeHtml(item.student_answer || '')}</textarea>
            </div>
          `;

          // If staff or released, show rubric criteria and grading
          if (item.rubric_criteria && (isStaff || isReleased)) {
            const rubricHtml = item.rubric_criteria.map(rc => {
              const grade = rc.grade;
              let gradingControl = '';
              if (isStaff && !isReleased && attempt.status !== 'in_progress') {
                gradingControl = `
                  <div class="form-row mt-2">
                    <div class="col" style="flex:1;">
                      <label>Score (Max ${rc.max_points})</label>
                      <input type="number" class="input-control single-rc-score" data-rc-id="${rc.id}" data-attempt-id="${attempt.id}" min="0" max="${rc.max_points}" step="any" value="${grade ? grade.score : ''}">
                    </div>
                    <div class="col" style="flex:2;">
                      <label>Feedback</label>
                      <input type="text" class="input-control single-rc-feedback" data-rc-id="${rc.id}" value="${escapeHtml(grade?.feedback || '')}" placeholder="Feedback...">
                    </div>
                    <div class="col" style="flex:0.5; display:flex; align-items:flex-end;">
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.saveSingleRubricGrade('${attempt.id}', '${rc.id}')">Save</button>
                    </div>
                  </div>
                `;
              } else if (grade) {
                gradingControl = `
                  <div class="mt-1 p-2" style="background:#f8fafc; border-radius:4px;">
                    <strong>Score:</strong> ${grade.score} / ${rc.max_points} pts<br>
                    <strong>Feedback:</strong> ${escapeHtml(grade.feedback || 'No written feedback')}
                  </div>
                `;
              }

              return `
                <div class="mt-2 pt-2" style="border-top:1px dashed var(--color-border);">
                  <div class="d-flex justify-content-between">
                    <strong>Rubric: ${escapeHtml(rc.label)}</strong>
                    <span class="badge badge-neutral">${rc.max_points} pts max</span>
                  </div>
                  ${gradingControl}
                </div>
              `;
            }).join('');

            contentHtml += `<div class="mt-3"><h5>Rubric & Feedback</h5>${rubricHtml}</div>`;
          }
        }

        itemCard.innerHTML = contentHtml;
        itemsContainer.appendChild(itemCard);
      }

      // Footer Actions
      const footer = document.getElementById('attempt-modal-footer');
      footer.innerHTML = '<button type="button" class="btn btn-secondary" data-close-modal>Close</button>';

      if (isStudent && isInProgress) {
        footer.innerHTML = `
          <button type="button" class="btn btn-secondary" data-close-modal>Close</button>
          <button type="button" id="btn-save-answers" class="btn btn-secondary" onclick="window.saveAttemptAnswers('${attempt.id}')">Save Answers</button>
          <button type="button" id="btn-submit-attempt" class="btn btn-primary" onclick="window.submitAttempt('${attempt.id}')">Submit Assessment</button>
        `;
      }

      openModal('modal-attempt');
    } catch (err) {
      showToast(err.data?.error || err.message || 'Failed to open attempt', 'error');
    }
  };

  window.saveAttemptAnswers = async function(attemptId) {
    const answers = [];
    document.querySelectorAll('.attempt-ans-input').forEach(input => {
      const itemId = input.getAttribute('data-item-id');
      if (input.type === 'radio') {
        if (input.checked) answers.push({ item_id: itemId, value: input.value });
      } else {
        answers.push({ item_id: itemId, value: input.value });
      }
    });

    const btn = document.getElementById('btn-save-answers');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    try {
      await apiCall('POST', `/api/attempts/${attemptId}/answers`, { answers }, true);
      showToast('Answers saved!', 'success');
      await refreshWorkspaceData(false);
    } catch (err) {
      showToast(err.data?.error || err.message || 'Save failed', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Answers';
      }
    }
  };

  window.submitAttempt = async function(attemptId) {
    if (!confirm('Are you ready to submit your assessment? Submission is terminal.')) return;

    // First save current answers
    await window.saveAttemptAnswers(attemptId);

    const btn = document.getElementById('btn-submit-attempt');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting...';
    }

    try {
      await apiCall('POST', `/api/attempts/${attemptId}/submit`, {}, true);
      showToast('Assessment submitted successfully!', 'success');
      closeModal('modal-attempt');
      await refreshWorkspaceData(true);
    } catch (err) {
      showToast(err.data?.error || err.message || 'Submission failed', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit Assessment';
      }
    }
  };

  window.saveSingleRubricGrade = async function(attemptId, criterionId) {
    const scoreInput = document.querySelector(`.single-rc-score[data-rc-id="${criterionId}"]`);
    const feedbackInput = document.querySelector(`.single-rc-feedback[data-rc-id="${criterionId}"]`);

    const scoreVal = scoreInput.value.trim();
    if (scoreVal === '') {
      showToast('Please enter a score', 'error');
      scoreInput.focus();
      return;
    }

    try {
      await apiCall('POST', '/api/grading/rubric', {
        attempt_id: attemptId,
        criterion_id: criterionId,
        score: Number(scoreVal),
        feedback: feedbackInput.value.trim()
      }, true);
      showToast('Rubric grade saved!', 'success');
      await refreshWorkspaceData(false);
      window.openAttemptModal(attemptId);
    } catch (err) {
      showToast(err.data?.error || err.message || 'Failed to save grade', 'error');
    }
  };

  // -------------------------------------------------------------
  // Initial App Load Check
  // -------------------------------------------------------------
  async function init() {
    if (state.token) {
      try {
        await initAuthenticatedApp();
      } catch (e) {
        console.warn('Initial session check failed:', e);
        handleUnauthorized();
      }
    } else {
      handleUnauthorized();
    }
  }

  // Run initial setup
  init();
})();

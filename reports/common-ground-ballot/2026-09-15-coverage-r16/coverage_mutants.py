def mutate(app, name):
    if not name:
        return
    path = app / ('server.js' if name in ('observer_members_denied', 'observer_audit_denied') else 'public/app.js')
    source = path.read_text(encoding='utf-8')
    changes = {
        'observer_members_denied': ('app.get("/api/members", requireUser, requireRole("coordinator", "observer"),', 'app.get("/api/members", requireUser, requireRole("coordinator"),'),
        'observer_audit_denied': ('app.get("/api/audit", requireUser, requireRole("coordinator", "observer"),', 'app.get("/api/audit", requireUser, requireRole("coordinator"),'),
        'observer_setup_hidden': ('  const list = byId("ballots-list");', '  const list = byId("ballots-list");\n  if(state.user.role === "observer") { list.innerHTML = "<p>Read only</p>"; return; }'),
        'observer_results_hidden': ('  const list = byId("results-list");', '  const list = byId("results-list");\n  if(state.user.role === "observer") { list.innerHTML = "<p>Read only</p>"; return; }'),
        'color_only_status': ('<span aria-hidden="true"></span>${escapeHtml(status)}</span>', '<span aria-hidden="true"></span></span>'),
        'unexplained_draft_publish': ('<p class="action-guidance">Closing and publishing are unavailable while this ballot is a draft. Open it to begin voting.</p>', '<button class="button secondary compact" type="button" data-ballot-action="publish" data-id="${escapeHtml(ballot.id)}">Publish results</button>'),
    }
    old, new = changes[name]
    assert source.count(old) == 1, (name, source.count(old))
    path.write_text(source.replace(old, new, 1), encoding='utf-8')

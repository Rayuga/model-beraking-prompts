# Product and delivery

Oriel Permitworks is the internal construction-permit desk for the fictional
City of Oriel. It is not a citizen portal or a generic project tracker. The
browser should feel like a polished desktop operations product and make the
current staff member, role, district, visible permit queue, summary counts,
record details, current state, and available next actions easy to understand.

Run one non-watch server on `0.0.0.0:3000`. Serve both the browser application
and its server behavior from that process. Use Node.js, Express, and SQLite,
with SQLite as the durable source of truth. Include an app-root Dockerfile that
exposes port 3000 and an `APP_MANIFEST.md` whose `bash start` fenced block gives
the launch command and briefly explains how the authenticated browser talks to
the server. Sessions and all municipal records must survive restart.

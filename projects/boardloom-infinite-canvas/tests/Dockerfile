# The verifier image. Harbor treats tests/ as the environment directory for the
# separate verifier ([verifier] environment_mode = "separate"), so this file is
# REQUIRED — without it the trial dies with "has no environment definition".
#
# It needs Node (to run `npm start` on the submitted app), Chromium + the
# Playwright MCP server (for the browser judges) and rewardkit (to score them).
FROM node@sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96 AS node-runtime
FROM python@sha256:2fe5997d249a808b8eeea52c58a1dbffbba28754dc11699ef5c029f2d818ce79

COPY --from=node-runtime /usr/local /usr/local

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_PATH=/usr/local/lib/node_modules \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

# Debian packages come from a frozen snapshot of the base image's own release, so an apt build today and in six
# months resolve the same versions. Without this the base digests are pinned but
# the packages installed on top of them are not.
ARG DEBIAN_SNAPSHOT=20260101T000000Z
RUN printf '%s\n' \
      "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} trixie main" \
      "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT} trixie-security main" \
      "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} trixie-updates main" \
      > /etc/apt/sources.list \
    && rm -f /etc/apt/sources.list.d/*.list \
    && printf 'Acquire::Retries "3";\nAcquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 python3-pip procps psmisc util-linux \
      fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      @openai/codex@0.151.0 @playwright/mcp@0.0.79 \
    && npm cache clean --force

RUN mkdir -p /opt/playwright-browsers \
    && PW_CLI="$(npm root -g)/playwright/cli.js" \
    && if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi \
    && node "$PW_CLI" install --with-deps chromium \
    && chmod -R a+rX /opt/playwright-browsers \
    && rm -rf /var/lib/apt/lists/*

# rewardkit registers the browser with `codex mcp add playwright`, and that call
# drops the approval and timeout settings the judge needs. This shim re-adds them
# straight afterwards. A task-scoped chromium name avoids colliding with anything
# else on the image.
RUN CHROMIUM_BIN="$(find /opt/playwright-browsers -type f -name 'chrome' -print -quit)" \
    && test -n "$CHROMIUM_BIN" \
    && ln -sf "$CHROMIUM_BIN" /usr/local/bin/boardloom-infinite-canvas-chromium \
    && mv /usr/local/bin/codex /usr/local/bin/codex-real \
    && printf '%s\n' \
      '#!/bin/sh' \
      '# rewardkit runs `codex mcp add playwright` once per dimension, and that' \
      '# call rewrites the server block without the approval and timeout settings' \
      '# the judge needs. Re-add them afterwards, idempotently, as valid TOML.' \
      'set -u' \
      'CODEX_REAL="/usr/local/bin/codex-real"' \
      'if [ "${1:-}" = "mcp" ] && [ "${2:-}" = "add" ]; then' \
      '  "$CODEX_REAL" "$@" || exit $?' \
      '  if [ "${3:-}" = "playwright" ]; then' \
      '    CFG="${CODEX_HOME:-${HOME:-/root}/.codex}/config.toml"' \
      '    [ -f "$CFG" ] && python3 - "$CFG" <<EOF' \
      'import re, sys' \
      'p = sys.argv[1]' \
      's = open(p).read()' \
      'm = re.search(r"\\[mcp_servers\\.playwright\\]\\n((?:(?!\\[).*\\n)*)", s)' \
      'if m:' \
      '    body = m.group(1)' \
      '    for k, v in (("required", "true"), ("startup_timeout_sec", "30"),' \
      '                 ("tool_timeout_sec", "120"),' \
      '                 ("default_tools_approval_mode", chr(34) + "approve" + chr(34))):' \
      '        if not re.search("^" + k + r"\\s*=", body, re.M):' \
      '            body += k + " = " + v + chr(10)' \
      '    open(p, "w").write(s[:m.start(1)] + body + s[m.end(1):])' \
      'EOF' \
      '  fi' \
      '  exit 0' \
      'fi' \
      'exec "$CODEX_REAL" "$@"' \
      > /usr/local/bin/codex \
    && chmod 755 /usr/local/bin/codex \
    && mkdir -p /root/.codex \
    && printf '%s\n' \
      'model_reasoning_effort = "max"' \
      'approval_policy = "never"' \
      'sandbox_mode = "danger-full-access"' \
      '' \
      '[mcp_servers.playwright]' \
      'command = "playwright-mcp"' \
      'args = ["--headless", "--isolated", "--executable-path=/usr/local/bin/boardloom-infinite-canvas-chromium", "--no-sandbox"]' \
      'required = true' \
      'startup_timeout_sec = 30' \
      'tool_timeout_sec = 120' \
      'default_tools_approval_mode = "approve"' \
      > /root/.codex/config.toml

RUN pip3 install --no-cache-dir \
      pyyaml==6.0.2 openai==2.30.0 python-dotenv==1.0.1 harbor-rewardkit==0.1.7

RUN mkdir -p /opt/playwright-browsers \
    && PW_CLI="$(npm root -g)/playwright/cli.js" \
    && if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi \
    && node "$PW_CLI" install --with-deps chromium \
    && chmod -R a+rX /opt/playwright-browsers \
    && rm -rf /var/lib/apt/lists/*

# Every package the app needs, installed at BUILD time and pinned to the exact
# versions the reference resolves, so nothing has to be fetched at grade time.
RUN mkdir -p /opt/boardloom/backend /opt/boardloom/frontend \
    && cd /opt/boardloom/backend && npm init -y >/dev/null \
    && npm install --no-audit --no-fund --ignore-scripts --loglevel=error \
      @types/cors@2.8.19 \
      @types/express@4.17.25 \
      @types/node@22.20.1 \
      @types/nodemailer@6.4.24 \
      cors@2.8.6 \
      express@4.22.2 \
      nodemailer@6.10.1 \
      tsx@4.23.12 \
      typescript@5.9.3 \
    && cd /opt/boardloom/frontend && npm init -y >/dev/null \
    && npm install --no-audit --no-fund --ignore-scripts --loglevel=error \
      @types/react-dom@18.3.7 \
      @types/react@18.3.31 \
      @vitejs/plugin-react@4.7.0 \
      autoprefixer@10.5.4 \
      postcss@8.5.26 \
      react-dom@18.3.1 \
      react@18.3.1 \
      tailwindcss@3.4.19 \
      typescript@5.9.3 \
      vite@5.4.21 \
    && npm cache clean --force \
    && chmod -R a+rX /opt/boardloom

RUN python3 -c "from pathlib import Path; p=Path('/usr/local/lib/python3.12/site-packages/rewardkit/agents.py'); s=p.read_text(); old='            \"--skip-git-repo-check\",\n'; new=old+'            \"--dangerously-bypass-approvals-and-sandbox\",\n'; assert old in s and new not in s; p.write_text(s.replace(old,new,1))"

COPY . /tests
RUN chmod +x /tests/test.sh && chmod -R go-rwx /tests
WORKDIR /tests

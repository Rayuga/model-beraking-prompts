FROM node:22-bookworm-slim AS node-runtime
FROM python:3.12-slim

COPY --from=node-runtime /usr/local /usr/local

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_PATH=/usr/local/lib/node_modules \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates python3 python3-pip procps util-linux fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      @openai/codex@0.151.0 \
      @playwright/mcp@0.0.79 \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
    && npm cache clean --force

RUN mkdir -p /root/.codex \
    && printf '%s\n' \
      'model_reasoning_effort = "max"' \
      'approval_policy = "never"' \
      'sandbox_mode = "danger-full-access"' \
      > /root/.codex/config.toml

RUN pip3 install --no-cache-dir \
      pyyaml==6.0.2 openai==2.30.0 python-dotenv==1.0.1 harbor-rewardkit==0.1.7

RUN mkdir -p /opt/playwright-browsers \
    && PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js" \
    && node "$PW_CLI" install --with-deps chromium \
    && chmod -R a+rX /opt/playwright-browsers \
    && CHROMIUM_BIN="$(find /opt/playwright-browsers -type f -name 'chrome' | head -n 1)" \
    && ln -sf "$CHROMIUM_BIN" /usr/local/bin/chromium \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -c "from pathlib import Path; p=Path('/usr/local/lib/python3.12/site-packages/rewardkit/agents.py'); s=p.read_text(); old='            \"--skip-git-repo-check\",\n'; new=old+'            \"--dangerously-bypass-approvals-and-sandbox\",\n'; assert old in s and new not in s; p.write_text(s.replace(old,new,1))"

ENV npm_config_build_from_source=true \
    npm_config_nodedir=/usr/local

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json /tmp/torquebay-package/
RUN mkdir -p /opt/torquebay-deps \
    && cp /tmp/torquebay-package/package.json /tmp/torquebay-package/package-lock.json /opt/torquebay-deps/ \
    && npm --prefix /opt/torquebay-deps ci --ignore-scripts --no-audit --no-fund \
    && cd /opt/torquebay-deps/node_modules/better-sqlite3 \
    && node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild --release --nodedir=/usr/local \
    && rm -rf /tmp/torquebay-package \
    && npm cache clean --force \
    && ln -sf /usr/local/bin/chromium /usr/local/bin/torquebay-chromium

LABEL org.codearena.task="torquebay-repair-operations" \
      org.turing.task="torquebay-repair-operations" \
      org.codearena.verifier-version="1.0.0" \
      org.turing.verifier-version="1.0.0" \
      org.codearena.verifier-image="codearena/torquebay-repair-operations-verifier:1.0.0"

COPY . /tests
RUN chmod +x /tests/test.sh && chmod -R go-rwx /tests
WORKDIR /tests

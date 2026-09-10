FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS node-runtime
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

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
      xlsx@0.18.5 \
    && npm cache clean --force

RUN mkdir -p /root/.codex /logs/verifier \
    && printf '%s\n' \
      'model_provider = "openrouter"' \
      'model_reasoning_effort = "high"' \
      'approval_policy = "never"' \
      'sandbox_mode = "danger-full-access"' \
      '' \
      '[model_providers.openrouter]' \
      'name = "OpenRouter"' \
      'base_url = "https://openrouter.ai/api/v1"' \
      'env_key = "OPENROUTER_API_KEY"' \
      'wire_api = "responses"' \
      'supports_websockets = false' \
      '' \
      '[mcp_servers.playwright]' \
      'command = "playwright-mcp"' \
      'args = ["--headless", "--isolated", "--executable-path=/usr/local/bin/chromium", "--no-sandbox"]' \
      'default_tools_approval_mode = "approve"' \
      > /root/.codex/config.toml

RUN pip3 install --no-cache-dir \
      pyyaml==6.0.2 openai==2.30.0 python-dotenv==1.0.1 harbor-rewardkit==0.1.7

RUN mkdir -p /opt/playwright-browsers \
    && PW_CLI="$(npm root -g)/playwright/cli.js" \
    && if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi \
    && node "$PW_CLI" install --with-deps chromium \
    && CHROMIUM_BIN="$(find /opt/playwright-browsers/chromium-* -type f -path '*/chrome-linux*/chrome' | sort -V | tail -n 1)" \
    && test -x "$CHROMIUM_BIN" \
    && ln -sf "$CHROMIUM_BIN" /usr/local/bin/chromium \
    && chmod -R a+rX /opt/playwright-browsers \
    && rm -rf /var/lib/apt/lists/*

# RewardKit 0.1.7 must grant the isolated Codex judge noninteractive MCP access.
RUN python3 -c "from pathlib import Path; p=Path('/usr/local/lib/python3.12/site-packages/rewardkit/agents.py'); s=p.read_text(); old='            \"--skip-git-repo-check\",\n'; new=old+'            \"--dangerously-bypass-approvals-and-sandbox\",\n'; assert old in s and new not in s; p.write_text(s.replace(old,new,1))"

# Fail the build if any declared judge command/browser is absent. The browser
# smoke uses the exact executable path in every judge.toml and needs no network.
RUN command -v codex && codex --version \
    && command -v playwright-mcp && playwright-mcp --version \
    && command -v rewardkit \
    && python3 -c "import importlib.metadata as m; assert m.version('harbor-rewardkit') == '0.1.7'" \
    && test -x /usr/local/bin/chromium
RUN node -e "const pw = require('node:module').createRequire(require.resolve('@playwright/mcp'))('playwright'); (async () => { const b = await pw.chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']}); try { const p = await b.newPage(); await p.setContent('<title>Brickfall verifier smoke</title>'); if (await p.title() !== 'Brickfall verifier smoke') throw new Error('browser smoke failed'); } finally { await b.close(); } })().catch(e => { console.error(e); process.exit(1); });"

LABEL org.turing.task="brickfall-breaker-arcade" \
      org.turing.verifier-version="2.0.4"

COPY brickfall_seed.xlsx /assets/artifacts/brickfall_seed.xlsx
COPY brickfall_scenarios.json /assets/artifacts/brickfall_scenarios.json
RUN chmod -R a+rX /assets
COPY . /tests
RUN mkdir -p /app /logs/verifier \
    && chmod +x /tests/test.sh && chmod -R go-rwx /tests
WORKDIR /tests

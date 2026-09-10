FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS node-runtime
FROM python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea

LABEL io.turing.task="patchpad-editor-v2" \
      io.turing.task.version="2.0.14"

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

# The platform's check-dockerfiles.py requires the separate verifier to carry
# its judge tools. Keep the prior PatchPad pins; never fetch tools at trial time.
# Only the platform supplies the actual credential. No key aliases or login
# setup are needed in test.sh: Codex reads this provider's environment key.
RUN mkdir -p /root/.codex \
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
    && chmod -R a+rX /opt/playwright-browsers \
    && CHROMIUM_BIN="$(find /opt/playwright-browsers -type f -name 'chrome' | head -n 1)" \
    && test -n "$CHROMIUM_BIN" && test -x "$CHROMIUM_BIN" \
    && ln -sf "$CHROMIUM_BIN" /usr/local/bin/chromium \
    && rm -rf /var/lib/apt/lists/*

# Fail the build if any declared judge command/browser is absent. The browser
# smoke uses the exact executable path in every judge.toml and needs no network.
RUN command -v codex && codex --version \
    && command -v playwright-mcp && playwright-mcp --version \
    && command -v rewardkit \
    && python3 -c "import importlib.metadata as m; assert m.version('harbor-rewardkit') == '0.1.7'" \
    && test -x /usr/local/bin/chromium
RUN node -e "const pw = require('node:module').createRequire(require.resolve('@playwright/mcp'))('playwright'); (async () => { const b = await pw.chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']}); try { const p = await b.newPage(); await p.setContent('<title>PatchPad verifier smoke</title>'); if (await p.title() !== 'PatchPad verifier smoke') throw new Error('browser smoke failed'); } finally { await b.close(); } })().catch(e => { console.error(e); process.exit(1); });"

RUN mkdir -p /opt/patchpad-deps \
    && cd /opt/patchpad-deps \
    && npm init -y >/dev/null \
    && npm install --omit=dev --no-audit --no-fund express@5.2.1 \
    && npm cache clean --force

COPY incident_seed.json /assets/incident_seed.json
RUN chmod -R a+rX /assets
COPY . /tests
RUN mkdir -p /app /logs/verifier \
    && chmod +x /tests/test.sh && chmod -R go-rwx /tests
WORKDIR /tests

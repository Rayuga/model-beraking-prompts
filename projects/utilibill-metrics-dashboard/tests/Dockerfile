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
      'model_provider = "openrouter"' \
      'model_reasoning_effort = "max"' \
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
    && ln -sf "$CHROMIUM_BIN" /usr/local/bin/chromium \
    && rm -rf /var/lib/apt/lists/*

COPY assets /assets
RUN chmod -R a+rX /assets
COPY . /tests
RUN chmod +x /tests/test.sh && chmod -R go-rwx /tests
WORKDIR /tests

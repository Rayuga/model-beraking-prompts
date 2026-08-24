# Reproducible verifier/agent image. Bump pins deliberately and re-run oracle.
FROM ubuntu:24.04@sha256:019e8eb29a85e74d64925745884f2ec79aa27e3feab36353d24656f4d6b89467

ARG NODE_MAJOR=22
# Applied on the apt install below — do not leave this declared-but-unused, or the
# runtime floats within 22.x under a Dockerfile that reads as fully pinned. The
# vendor desk ships as V8 bytecode, which is runtime-version-specific, so this pin
# is load-bearing. If NodeSource ages this version out of the repo the build will
# fail loudly (which is the intent); bump it deliberately and re-run the oracle.
ARG NODEJS_VERSION=22.23.2-1nodesource1
ARG OPENAI_VERSION=2.30.0
ARG PYTHON_DOTENV_VERSION=1.0.1
ARG HARBOR_REWARDKIT_VERSION=0.1.7
ARG CLAUDE_CODE_VERSION=2.1.223
ARG PLAYWRIGHT_MCP_VERSION=0.0.79

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        sqlite3 \
        postgresql-16 \
        postgresql-contrib-16 \
        postgresql-client-16 \
        git \
        procps \
        psmisc \
        iproute2 \
        tmux \
        fonts-liberation \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends "nodejs=${NODEJS_VERSION}" \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version && python3 --version

# Express + Stripe preinstalled so oracle / agent usually need no npm network.
RUN mkdir -p /opt/gearvault-deps \
    && cd /opt/gearvault-deps \
    && npm init -y >/dev/null \
    && npm install --omit=dev --ignore-scripts --no-audit --no-fund express@5.2.1 stripe@22.4.0 postgres@3.4.7 luxon@3.6.1 decimal.js@10.5.0 zod@3.24.2 ical-generator@8.1.1 \
    && npm cache clean --force

# RewardKit CUA judge: claude-code shells out to Playwright MCP.
RUN npm install -g --no-audit --no-fund \
        @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
        @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} \
    && npm cache clean --force

RUN pip3 install --break-system-packages --no-cache-dir \
        "pyyaml==6.0.2" \
        "openai==${OPENAI_VERSION}" \
        "python-dotenv==${PYTHON_DOTENV_VERSION}" \
        "harbor-rewardkit==${HARBOR_REWARDKIT_VERSION}"

# @playwright/mcp pins an exact alpha of playwright/playwright-core, and browser
# builds are revision-specific, so install Chromium with the SAME playwright the
# MCP bundles (reusing the copy npm already pulled in above) rather than a
# separately-versioned Playwright whose Chromium revision would not match.
RUN mkdir -p /opt/playwright-browsers && \
    PW_CLI="$(npm root -g)/playwright/cli.js" && \
    if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi && \
    node "$PW_CLI" install --with-deps chromium && \
    chmod -R a+rX /opt/playwright-browsers

# Seed material. environment/ is the image build context. The whole brief
# lives in instruction.md (Harbor injects it); do not copy a second copy.
COPY assets/ /assets/
COPY vendors/ /opt/gearvault-vendors/
COPY postgres/ /opt/gearvault-postgres/
COPY shop/ /opt/gearvault-shop/
# Keep executable scripts valid even when the task was unpacked on a Windows
# host that converted repository text files to CRLF.
RUN find /opt/gearvault-postgres /opt/gearvault-shop -type f -name '*.sh' \
    -exec sed -i 's/\r$//' {} +
# Compile the desk process to V8 bytecode so the agent image does not ship a
# readable route/HMAC cookbook at /opt/gearvault-vendors/server.js. The loader
# is the only .js left; verifier still starts it with `node server.js`.
RUN cd /opt/gearvault-vendors \
    && npm init -y >/dev/null \
    && npm install --omit=dev --ignore-scripts --no-audit --no-fund bytenode@1.5.7 \
    && npx bytenode --compile server.js \
    && rm -f server.js \
    && printf '%s\n' "require('bytenode');" "require('./server.jsc');" > server.js \
    && npm cache clean --force
RUN chmod -R a+rX /assets /opt/gearvault-vendors /opt/gearvault-postgres /opt/gearvault-shop \
    && chmod +x /opt/gearvault-postgres/start.sh \
    && chmod +x /opt/gearvault-shop/*.sh \
    && printf '%s\n' \
        'local all postgres peer' \
        'local all all md5' \
        'host all all 127.0.0.1/32 md5' \
        'host all all ::1/128 md5' \
        > /etc/postgresql/16/main/pg_hba.conf

WORKDIR /app
ENTRYPOINT ["/opt/gearvault-shop/entrypoint.sh"]
CMD ["sleep", "infinity"]

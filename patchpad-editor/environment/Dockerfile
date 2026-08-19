FROM ubuntu:24.04@sha256:019e8eb29a85e74d64925745884f2ec79aa27e3feab36353d24656f4d6b89467

ARG NODE_MAJOR=22
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
        ca-certificates=20260601~24.04.1 \
        curl=8.5.0-2ubuntu10.11 \
        gnupg=2.4.4-2ubuntu17.4 \
        build-essential=12.10ubuntu1 \
        python3=3.12.3-0ubuntu2.1 \
        python3-pip=24.0+dfsg-1ubuntu1.3 \
        python3-venv=3.12.3-0ubuntu2.1 \
        sqlite3=3.45.1-1ubuntu2.7 \
        git=1:2.43.0-1ubuntu7.3 \
        procps=2:4.0.4-4ubuntu3.2 \
        psmisc=23.7-1build1 \
        iproute2=6.1.0-1ubuntu6.4 \
        tmux=3.4-1ubuntu0.1 \
        fonts-liberation=1:2.1.5-3 \
        fonts-noto-color-emoji=2.047-0ubuntu0.24.04.1 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs=${NODEJS_VERSION} \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version && python3 --version

RUN mkdir -p /opt/patchpad-deps \
    && cd /opt/patchpad-deps \
    && npm init -y >/dev/null \
    && npm install --omit=dev --no-audit --no-fund express@5.2.1 \
    && npm cache clean --force

RUN npm install -g --no-audit --no-fund \
        @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
        @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} \
    && npm cache clean --force

RUN pip3 install --break-system-packages --no-cache-dir \
        "pyyaml==6.0.2" \
        "openai==${OPENAI_VERSION}" \
        "python-dotenv==${PYTHON_DOTENV_VERSION}" \
        "harbor-rewardkit==${HARBOR_REWARDKIT_VERSION}"

RUN mkdir -p /opt/playwright-browsers && \
    PW_CLI="$(npm root -g)/playwright/cli.js" && \
    if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi && \
    node "$PW_CLI" install --with-deps chromium && \
    chmod -R a+rX /opt/playwright-browsers

COPY assets/ /assets/
RUN chmod -R a+rX /assets

WORKDIR /app
CMD ["sleep", "infinity"]

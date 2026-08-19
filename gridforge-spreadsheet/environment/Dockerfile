FROM ubuntu:24.04@sha256:019e8eb29a85e74d64925745884f2ec79aa27e3feab36353d24656f4d6b89467

ARG NODE_MAJOR=22
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
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version && python3 --version

RUN mkdir -p /opt/gridforge-deps \
    && cd /opt/gridforge-deps \
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

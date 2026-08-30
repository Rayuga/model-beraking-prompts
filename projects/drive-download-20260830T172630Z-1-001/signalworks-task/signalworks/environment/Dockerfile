# Reproducible verifier/agent image. Bump pins deliberately and verify against
# the golden solution.
FROM ubuntu:24.04@sha256:019e8eb29a85e74d64925745884f2ec79aa27e3feab36353d24656f4d6b89467

ARG NODE_MAJOR=20
ARG OPENAI_VERSION=2.30.0
ARG PYTHON_DOTENV_VERSION=1.0.1
ARG HARBOR_REWARDKIT_VERSION=0.1.7
# codex CUA judge CLI (@openai/codex): self-contained binary, node-version independent. Pinned to the bootstrap-validated version.
ARG CODEX_VERSION=0.150.1
ARG PLAYWRIGHT_MCP_VERSION=0.0.79

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

# NODE_ENV is deliberately unset: npm's default --omit becomes "dev" whenever
# NODE_ENV=production is in the environment, which would silently skip any
# devDependencies a submission relies on. tests/test.py also unsets it.

# Reproducibility boundary, chosen deliberately: pin everything that can change
# how the task is GRADED (the base image by digest, the Node major, the exact
# claude-code / playwright-mcp / rewardkit versions below), and do NOT pin the
# OS tooling. Exact apt pins rot: Ubuntu published curl 8.5.0-2ubuntu10.13 as a
# security update, which made the previously-pinned .12 unresolvable and failed
# the image build outright. These packages are tooling only and cannot affect a
# score.
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

# RewardKit CUA judge: codex (openai/gpt-5.6-luna via OpenRouter) shells out to Playwright MCP.
RUN npm install -g --no-audit --no-fund \
        @openai/codex@${CODEX_VERSION} \
        @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} \
    && npm cache clean --force \
    && codex --version

RUN pip3 install --break-system-packages --no-cache-dir \
        "pyyaml==6.0.2" \
        "openai==${OPENAI_VERSION}" \
        "python-dotenv==${PYTHON_DOTENV_VERSION}" \
        "harbor-rewardkit==${HARBOR_REWARDKIT_VERSION}"

# @playwright/mcp pins an exact alpha of playwright/playwright-core and browser
# builds are revision-specific, so install Chromium with the SAME playwright the
# MCP bundles rather than a separately-versioned one.
RUN mkdir -p /opt/playwright-browsers && \
    PW_CLI="$(npm root -g)/playwright/cli.js" && \
    if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi && \
    node "$PW_CLI" install --with-deps chromium && \
    chmod -R a+rX /opt/playwright-browsers && \
    CHROMIUM_BIN="$(find /opt/playwright-browsers -type f -path '*/chrome-linux64/chrome' | head -n 1)" && \
    ln -sf "$CHROMIUM_BIN" /usr/local/bin/chromium && \
    chromium --version

# The brief is split by topic and baked in, per the client authoring standard.
COPY instructions/ /instructions/
COPY assets/ /assets/

WORKDIR /app

CMD ["sleep", "infinity"]

FROM ubuntu:24.04@sha256:019e8eb29a85e74d64925745884f2ec79aa27e3feab36353d24656f4d6b89467

ARG NODE_MAJOR=22

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
        git \
        procps \
        psmisc \
        util-linux \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/dropline-deps \
    && cd /opt/dropline-deps \
    && npm init -y >/dev/null \
    && npm install --omit=dev --no-audit --no-fund express@5.2.1 \
    && npm cache clean --force

RUN pip3 install --break-system-packages --no-cache-dir \
        "playwright==1.49.0"

RUN mkdir -p /opt/playwright-browsers \
    && playwright install --with-deps chromium \
    && chmod -R a+rX /opt/playwright-browsers \
    && CHROMIUM_BIN="$(find /opt/playwright-browsers -type f \( -path '*/chrome-linux/chrome' -o -path '*/chrome-linux64/chrome' -o -name headless_shell \) | head -n 1)" \
    && test -n "$CHROMIUM_BIN" \
    && ln -sf "$CHROMIUM_BIN" /usr/local/bin/chromium \
    && chromium --version

RUN useradd --create-home --uid 10001 app-runner

COPY . /tests
RUN chmod 0555 /tests/test.sh \
    && chmod -R a-w /tests

WORKDIR /tests

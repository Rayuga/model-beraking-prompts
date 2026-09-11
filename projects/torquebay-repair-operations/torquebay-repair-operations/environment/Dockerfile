FROM node:22-bookworm-slim

LABEL org.codearena.task="torquebay-repair-operations" \
      io.turing.task="torquebay-repair-operations" \
      io.turing.task-version="1.0.0"

ENV NODE_PATH=/opt/torquebay-deps/node_modules \
    PATH=/opt/torquebay-deps/node_modules/.bin:$PATH \
    npm_config_build_from_source=true \
    npm_config_nodedir=/usr/local

RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      ca-certificates git build-essential python3 sqlite3 curl coreutils procps psmisc iproute2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json /tmp/torquebay-package/
RUN mkdir -p /opt/torquebay-deps \
    && cp /tmp/torquebay-package/package.json /tmp/torquebay-package/package-lock.json /opt/torquebay-deps/ \
    && npm --prefix /opt/torquebay-deps ci --ignore-scripts --no-audit --no-fund \
    && cd /opt/torquebay-deps/node_modules/better-sqlite3 \
    && node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild --release --nodedir=/usr/local \
    && rm -rf /tmp/torquebay-package

COPY assets/ /assets/
COPY instructions/ /instructions/
RUN chmod -R a+rX /assets /instructions /opt/torquebay-deps \
    && mkdir -p /app \
    && git -C /app init -q \
    && git -C /app config user.name "Turing" \
    && git -C /app config user.email "turing@local.invalid" \
    && touch /app/.gitkeep \
    && git -C /app add .gitkeep \
    && git -C /app commit -q -m "Initialize task workspace"

WORKDIR /app
CMD ["sleep", "infinity"]

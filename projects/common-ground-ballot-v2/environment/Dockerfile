FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

ENV NODE_PATH=/usr/local/lib/node_modules
LABEL io.turing.task="common-ground-ballot-v2" \
      io.turing.task.version="2.0.0"

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git procps sqlite3 curl coreutils python3 \
    && update-ca-certificates \
    && test -s /etc/ssl/certs/ca-certificates.crt \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
    && npm cache clean --force

COPY instructions/ /instructions/
COPY assets/ /assets/

RUN chmod -R a+rX /instructions /assets \
    && mkdir -p /app \
    && git -C /app init \
    && git -C /app config user.name "Turing" \
    && git -C /app config user.email "turing@local.invalid" \
    && touch /app/.gitkeep \
    && git -C /app add .gitkeep \
    && git -C /app commit -m "Initialize task workspace"

WORKDIR /app
CMD ["sleep", "infinity"]

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

LABEL org.turing.task="brickfall-breaker-arcade" org.turing.task-version="2.0.4"

ENV NODE_PATH=/usr/local/lib/node_modules

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl coreutils git procps sqlite3 python3 python3-openpyxl \
    && update-ca-certificates \
    && test -s /etc/ssl/certs/ca-certificates.crt \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
      xlsx@0.18.5 \
    && npm cache clean --force

COPY assets/instructions/ /instructions/
COPY assets/artifacts/brickfall_seed.xlsx /assets/artifacts/brickfall_seed.xlsx
COPY assets/artifacts/brickfall_scenarios.json /assets/artifacts/brickfall_scenarios.json
RUN chmod -R a+rX /instructions /assets && mkdir -p /app

WORKDIR /app
CMD ["sleep", "infinity"]

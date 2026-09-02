FROM node:22-bookworm-slim

ENV NODE_PATH=/usr/local/lib/node_modules

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git procps sqlite3 python3 python3-openpyxl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
      xlsx@0.18.5 \
    && npm cache clean --force

COPY instructions/ /instructions/
COPY assets/artifacts/brickfall_seed.xlsx /assets/artifacts/brickfall_seed.xlsx
RUN chmod -R a+rX /instructions /assets && mkdir -p /app

WORKDIR /app
CMD ["sleep", "infinity"]

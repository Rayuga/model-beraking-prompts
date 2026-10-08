FROM node:22-bookworm-slim

ENV NODE_PATH=/usr/local/lib/node_modules

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git procps sqlite3 \
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

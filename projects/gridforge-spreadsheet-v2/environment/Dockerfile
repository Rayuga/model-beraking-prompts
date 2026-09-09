FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

LABEL io.turing.task="gridforge-spreadsheet-v2" \
      io.turing.task.version="2.0.8"

ENV NODE_PATH=/usr/local/lib/node_modules

# Harbor's agent bootstrap checks these tools before starting the model.
RUN apt-get update && apt-get install -y --no-install-recommends curl coreutils \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/gridforge-deps \
    && cd /opt/gridforge-deps \
    && npm init -y >/dev/null \
    && npm install --omit=dev --no-audit --no-fund express@5.2.1 \
    && npm cache clean --force

COPY assets/ /assets/
COPY assets/instructions/ /instructions/
RUN chmod -R a+rX /assets /instructions && mkdir -p /app

WORKDIR /app
CMD ["sleep", "infinity"]

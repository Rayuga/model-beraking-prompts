FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

LABEL io.turing.task="patchpad-editor-v2" \
      io.turing.task.version="2.0.9"

ENV NODE_PATH=/usr/local/lib/node_modules

RUN mkdir -p /opt/patchpad-deps \
    && cd /opt/patchpad-deps \
    && npm init -y >/dev/null \
    && npm install --omit=dev --no-audit --no-fund express@5.2.1 \
    && npm cache clean --force

COPY assets/ /assets/
COPY assets/instructions/ /instructions/
RUN chmod -R a+rX /assets /instructions && mkdir -p /app

WORKDIR /app
CMD ["sleep", "infinity"]

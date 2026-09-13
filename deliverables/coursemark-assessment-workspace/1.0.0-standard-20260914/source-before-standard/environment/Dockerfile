FROM node:22-bookworm

LABEL io.turing.task="coursemark-assessment-workspace" \
      io.turing.task.version="1.0.20"

ENV NODE_PATH=/usr/local/lib/node_modules

RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
    && npm cache clean --force

COPY assets/artifacts/ /assets/artifacts/
COPY assets/instructions/ /instructions/
RUN chmod -R a+rX /assets /instructions && mkdir -p /app

WORKDIR /app
CMD ["sleep", "infinity"]

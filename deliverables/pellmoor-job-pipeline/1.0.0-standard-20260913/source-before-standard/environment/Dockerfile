# Agent workspace. Copies only task inputs -- never solution/ or tests/, because an
# agent able to read either would invalidate every score this task produces.
FROM node:22-bookworm

LABEL io.turing.task="pellmoor-job-pipeline" \
      io.turing.task.version="2.0.12"

ENV NODE_PATH=/usr/local/lib/node_modules

RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
      typescript@5.7.2 \
      esbuild@0.24.2 \
      d3@7.9.0 \
    && npm cache clean --force

COPY assets/recruitment/ /recruitment/
COPY assets/instructions/ /instructions/
RUN chmod -R a+rX /recruitment /instructions && mkdir -p /app

WORKDIR /app
CMD ["sleep", "infinity"]

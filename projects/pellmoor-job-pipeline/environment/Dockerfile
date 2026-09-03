# Agent workspace. Copies only assets/ — never solution/ or tests/, because an
# agent able to read either would invalidate every score this task produces.
FROM node:22-bookworm-slim

ENV NODE_PATH=/usr/local/lib/node_modules

# Build toolchain for the better-sqlite3 addon, plus the ordinary tools for
# opening what the attachments are saved as: poppler-utils reads a PDF text
# layer, unzip opens the OOXML files. No apt version pins.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates git procps sqlite3 unzip poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
      typescript@5.7.2 \
      esbuild@0.24.2 \
      d3@7.9.0 \
    && npm cache clean --force

COPY recruitment/ /recruitment/
RUN chmod -R a+rX /recruitment && mkdir -p /workspace/pellmoor-job-pipeline

WORKDIR /workspace/pellmoor-job-pipeline
CMD ["sleep", "infinity"]

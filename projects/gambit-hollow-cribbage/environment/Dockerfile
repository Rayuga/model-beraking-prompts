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
    && npm cache clean --force

COPY club/ /club/
RUN chmod -R a+rX /club && mkdir -p /home/build/gambit-hollow-board-games

WORKDIR /home/build/gambit-hollow-board-games
CMD ["sleep", "infinity"]

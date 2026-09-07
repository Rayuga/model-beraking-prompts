FROM node:22-bookworm-slim

ENV NODE_PATH=/usr/local/lib/node_modules

# Build toolchain for the better-sqlite3 native addon (falls back to source
# compilation if no prebuilt binary matches this platform), plus the ordinary
# tools for working with the catalogue.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates git procps sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Server runtime deps, plus the React/Vite/Tailwind toolchain available
# globally so a build never depends on registry access at grading time. An
# agent with network access is free to `npm install` its own local copies
# instead — network_mode is public precisely so that also works.
RUN npm install -g --no-audit --no-fund \
      express@5.1.0 \
      better-sqlite3@12.4.1 \
      vite@5.4.21 \
      @vitejs/plugin-react@4.3.4 \
      react@18.3.1 \
      react-dom@18.3.1 \
      tailwindcss@3.4.17 \
      postcss@8.4.49 \
      autoprefixer@10.4.20 \
    && npm cache clean --force

COPY catalogue/ /catalogue/
RUN chmod -R a+rX /catalogue

WORKDIR /app
CMD ["sleep", "infinity"]

FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npm rebuild better-sqlite3 --release

COPY server.js index.html jsconfig.json postcss.config.js tailwind.config.js vite.config.js APP_MANIFEST.md ./
COPY server ./server
COPY src ./src
RUN npm run build

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]

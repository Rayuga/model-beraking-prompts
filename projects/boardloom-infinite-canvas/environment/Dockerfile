FROM node@sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96 AS node-runtime
FROM python@sha256:2fe5997d249a808b8eeea52c58a1dbffbba28754dc11699ef5c029f2d818ce79


ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/usr/local/bin:${PATH}"

# Do not set NODE_ENV=production: npm would omit Vite/Tailwind on install.
# Debian packages come from a frozen snapshot of the base image's own release, so an apt build today and in six
# months resolve the same versions. Without this the base digests are pinned but
# the packages installed on top of them are not.
ARG DEBIAN_SNAPSHOT=20260101T000000Z
RUN printf '%s\n' \
      "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} trixie main" \
      "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT} trixie-security main" \
      "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} trixie-updates main" \
      > /etc/apt/sources.list \
    && rm -f /etc/apt/sources.list.d/*.list \
    && printf 'Acquire::Retries "3";\nAcquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg build-essential \
        python3 python3-pip python3-venv \
        sqlite3 git procps psmisc iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (node:sqlite) comes from the official pinned image, not a live download.
COPY --from=node-runtime /usr/local /usr/local
RUN node --version && npm --version && python3 --version \
    && test "$(node -p "process.versions.node.split('.')[0]")" = "22"

# Every package the app needs, installed at BUILD time and pinned to the exact
# versions the reference resolves, so nothing has to be fetched at run time.
RUN mkdir -p /opt/boardloom/backend /opt/boardloom/frontend \
    && cd /opt/boardloom/backend && npm init -y >/dev/null \
    && npm install --no-audit --no-fund --ignore-scripts --loglevel=error \
      @types/cors@2.8.19 \
      @types/express@4.17.25 \
      @types/node@22.20.1 \
      @types/nodemailer@6.4.24 \
      cors@2.8.6 \
      express@4.22.2 \
      nodemailer@6.10.1 \
      tsx@4.23.12 \
      typescript@5.9.3 \
    && cd /opt/boardloom/frontend && npm init -y >/dev/null \
    && npm install --no-audit --no-fund --ignore-scripts --loglevel=error \
      @types/react-dom@18.3.7 \
      @types/react@18.3.31 \
      @vitejs/plugin-react@4.7.0 \
      autoprefixer@10.5.4 \
      postcss@8.5.26 \
      react-dom@18.3.1 \
      react@18.3.1 \
      tailwindcss@3.4.19 \
      typescript@5.9.3 \
      vite@5.4.21 \
    && npm cache clean --force \
    && chmod -R a+rX /opt/boardloom

COPY assets/ /instructions/
RUN chmod -R a+rX /instructions \
    && mkdir -p /app \
    && chmod -R a+rwX /app

WORKDIR /app

CMD ["sleep", "infinity"]

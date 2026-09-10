# AGENT image. Carries only what is needed to BUILD and RUN a Node.js +
# Express + SQLite application, plus the brief, the seed artifact, and the
# plant-network vendor desks.
#
# Deliberately carries no part of the scoring stack. Everything used to score a
# submission lives in the separate verifier image, so the agent has no
# visibility into how it will be scored and no way to interfere with it.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    NODE_PATH=/usr/local/lib/node_modules

# Deliberately NOT setting NODE_ENV=production: npm's default --omit becomes
# "dev" whenever it is set.

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      build-essential \
      python3 \
      git \
      curl \
      procps \
      psmisc \
      iproute2 \
      sqlite3 \
      tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version

# Brief, seed, and plant desks. environment/ is the image build context.
COPY instructions/ /instructions/
COPY assets/ /assets/
COPY vendors/ /opt/drawbill-vendors/
# Compile the vendor desks so desk rates are not sitting in readable source
# while the product is being built. The wrapper is still Node.
RUN cd /opt/drawbill-vendors \
    && npm init -y >/dev/null \
    && npm install --omit=dev --ignore-scripts --no-audit --no-fund bytenode@1.5.7 \
    && npx bytenode --compile desks.js \
    && rm -f desks.js \
    && printf '%s\n' "require('bytenode');" "require('./desks.jsc');" > desks.js \
    && npm cache clean --force
RUN chmod -R a+rX /instructions /assets /opt/drawbill-vendors

# Frozen application tarballs so the agent can `npm ci` from `/assets/npm-pin/`
# against the same cache the verifier uses at grade time. The resolved tree is
# kept as well, at /opt/drawbill-deps: the reference stages that copy rather
# than resolving anything itself, so no phase of this task needs a registry.
RUN mkdir -p /opt/npm-offline /opt/drawbill-deps \
 && cp /assets/npm-pin/package.json /opt/drawbill-deps/package.json \
 && cp /assets/npm-pin/package-lock.json /opt/drawbill-deps/package-lock.json \
 && cd /opt/drawbill-deps \
 && npm ci --cache /opt/npm-offline --omit=dev --ignore-scripts --no-audit --no-fund \
 && chmod -R a+rX /opt/npm-offline /opt/drawbill-deps \
 && test -d /opt/npm-offline/_cacache \
 && test -d /opt/drawbill-deps/node_modules/express

COPY entrypoint.sh /usr/local/bin/drawbill-entrypoint.sh
RUN chmod 0755 /usr/local/bin/drawbill-entrypoint.sh

WORKDIR /app
CMD ["/usr/local/bin/drawbill-entrypoint.sh"]

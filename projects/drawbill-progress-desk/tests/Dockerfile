# VERIFIER image. Carries the judge toolchain and a browser, and nothing about
# the task the agent could read: the agent's image (environment/Dockerfile) has
# no rewardkit, no codex and no Playwright, and /tests never reaches it.
FROM node:22-bookworm-slim AS node-runtime
FROM python:3.12-slim

COPY --from=node-runtime /usr/local /usr/local

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_PATH=/usr/local/lib/node_modules \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers \
    XDG_CACHE_HOME=/opt/rk-cache

# Deliberately NOT setting NODE_ENV=production: npm would then skip
# devDependencies, and some submissions put a frontend build toolchain there.
# tests/test.sh unsets it again before the install for the same reason.

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl procps util-linux passwd \
      fonts-liberation fonts-noto-color-emoji \
      build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-audit --no-fund \
      @playwright/mcp@0.0.79 \
      @openai/codex@0.153.2 \
    && npm cache clean --force

# The 'codex' judge driver is installed at image build (npm @openai/codex plus
# RewardKit's pinned binary below). It is never fetched at trial time.

# The judge writes its own CODEX_HOME per session (see /opt/judge/run_judge.py);
# this baked copy is only a fallback for manual debugging inside the image.
RUN mkdir -p /root/.codex \
    && printf '%s\n' \
      'model_provider = "openrouter"' \
      '' \
      '[model_providers.openrouter]' \
      'name = "OpenRouter"' \
      'base_url = "https://openrouter.ai/api/v1"' \
      'env_key = "OPENROUTER_API_KEY"' \
      'wire_api = "responses"' \
      > /root/.codex/config.toml

RUN pip3 install --no-cache-dir \
      pyyaml==6.0.2 openai==2.30.0 python-dotenv==1.0.1 harbor-rewardkit==0.2.0

# RewardKit 0.2.0 does not use a codex from PATH. It resolves its own pinned
# release under XDG_CACHE_HOME and, when that is missing, downloads it with curl
# at grading time — which the pinned scoring allowlist forbids. So install
# exactly the release RewardKit asks for, at exactly the path it looks in, while
# the build still has open network. The version is read out of the installed
# RewardKit rather than hard-coded, so it cannot drift from the pin.
RUN set -eu; \
    CODEX_VER="$(python3 -c 'import rewardkit.agents as rk; print(rk._CODEX_VERSION)')"; \
    CODEX_URL="$(python3 -c 'import rewardkit.agents as rk; print(rk._CODEX_INSTALL_URL)')"; \
    DIR="$(python3 -c 'import rewardkit.agents as rk; print(rk._codex_cache_dir())')"; \
    echo "installing codex ${CODEX_VER} into ${DIR}"; \
    mkdir -p "${DIR}/bin" "${DIR}/installer-home"; \
    CODEX_RELEASE="${CODEX_VER}" CODEX_NON_INTERACTIVE=1 \
      CODEX_INSTALL_DIR="${DIR}/bin" CODEX_HOME="${DIR}/installer-home" \
      sh -c "curl -fsSL '${CODEX_URL}' | sh"; \
    chmod -R a+rX /opt/rk-cache

# Fail the build rather than ship a verifier that cannot judge: this is the exact
# call RewardKit makes at grading time, and it must resolve offline.
# Kept to ONE line, using an "import x.y as z" form. A backslash continuation
# whose next line begins with the word "from" is read by Dockerfile linters as an
# untagged FROM instruction and blocks the build; a heredoc would avoid that too
# but needs BuildKit, so a single line is the portable choice.
RUN python3 -c "import rewardkit.agents as rk; b = rk._ensure_codex_installed(); v = rk._codex_binary_version(b); assert v == rk._CODEX_VERSION, (b, v, rk._CODEX_VERSION); print('codex', v, 'resolved offline at', b)"

# Two separate reasons the judge used to find itself without a browser, both of
# which cost whole dimensions:
#
#  1. `--browser=chromium` does not get @playwright/mcp the plain `chromium`
#     download. It resolves to Playwright's Chrome for Testing build, which
#     unpacks to chrome-linux64/chrome rather than chrome-linux/chrome, so a
#     verifier carrying only `chromium` answered every browser call with
#     `Browser "chrome-for-testing" is not installed`. Both flavours are
#     installed here, with the same Playwright that @playwright/mcp imports so
#     the build revisions cannot disagree.
#  2. codex does not hand its own environment to a stdio MCP server, so
#     PLAYWRIGHT_BROWSERS_PATH did not reach the one it launches and Playwright
#     looked in its default ~/.cache/ms-playwright instead. run_judge.py now
#     passes the path explicitly, and the default location is pointed at the
#     same directory so the lookup succeeds either way.
RUN set -eu; \
    mkdir -p /opt/playwright-browsers; \
    PW_CLI="$(npm root -g)/playwright/cli.js"; \
    if [ ! -f "$PW_CLI" ]; then PW_CLI="$(npm root -g)/@playwright/mcp/node_modules/playwright/cli.js"; fi; \
    node "$PW_CLI" install --with-deps chromium; \
    node "$PW_CLI" install --with-deps chrome-for-testing \
      || node "$PW_CLI" install chrome-for-testing \
      || echo "chrome-for-testing is not a target of this Playwright; relying on chromium" >&2; \
    mkdir -p /root/.cache; \
    ln -sfn /opt/playwright-browsers /root/.cache/ms-playwright; \
    chmod -R a+rX /opt/playwright-browsers; \
    rm -rf /var/lib/apt/lists/*

# Fail the build rather than ship a verifier that cannot open a page. The judge
# reports an unreachable browser as a failed criterion, so a missing executable
# here is indistinguishable in the reward from a broken submission.
RUN set -eu; \
    found="$(find /opt/playwright-browsers -type f -name chrome \
      \( -path '*chrome-linux64*' -o -path '*chrome-linux*' \) -print -quit)"; \
    if [ -z "$found" ]; then \
      echo 'no chromium-family executable under /opt/playwright-browsers' >&2; \
      ls -R /opt/playwright-browsers >&2 || true; \
      exit 1; \
    fi; \
    echo "browser resolved offline at $found"; \
    test -x "$found"

RUN mkdir -p /assets/artifacts

# __judge__/ is named so RewardKit's discovery skips it: it filters out any
# directory starting with "." or "__". A plain name would be scanned as a
# scoring dimension and its module imported as a criteria factory.
COPY __judge__/run_judge.py /opt/judge/run_judge.py
RUN chmod a+rx /opt/judge/run_judge.py

COPY . /tests
RUN cp /tests/__vendors__/desks.js /opt/drawbill-plant \
 && chmod +x /tests/test.sh /tests/__vendors__/start.sh \
 && chmod -R go-rwx /tests
WORKDIR /tests

# Application tarballs for scoring. Image build still has network; the running
# verifier allowlist is the judge provider and nothing else, so test.sh must
# install the submission from this cache with npm_config_offline=true. The
# resolved tree is kept as well, at /opt/drawbill-deps: when a submission's own
# install fails -- typically a dependency outside the frozen pin, which this
# cache does not carry -- test.sh stages that tree instead of abandoning the
# trial, so the app is judged on what it does rather than zeroed before a judge
# ever runs.
RUN mkdir -p /opt/npm-offline /opt/drawbill-deps \
 && cp /tests/__assets__/drawbill-npm-package.json /opt/drawbill-deps/package.json \
 && cp /tests/__assets__/drawbill-npm-package-lock.json /opt/drawbill-deps/package-lock.json \
 && cd /opt/drawbill-deps \
 && npm ci --cache /opt/npm-offline --ignore-scripts --no-audit --no-fund \
 && chmod -R a+rX /opt/npm-offline /opt/drawbill-deps \
 && test -d /opt/npm-offline/_cacache \
 && test -d /opt/drawbill-deps/node_modules/express

# Scoring stays root so Harbor can copy /app and write /logs. Install, the
# optional Vite build, and the submitted Node process are launched as uid 10001
# from test.sh via runuser. There is no USER directive here because the judge
# toolchain still needs root; dropping the whole image to grader would break
# RewardKit and /tests perms.
RUN useradd --system --uid 10001 --no-create-home --home-dir /opt/grader \
      --shell /bin/bash grader \
    && mkdir -p /opt/grader \
    && chmod a+rX /opt /usr/local /opt/grader

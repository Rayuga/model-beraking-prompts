FROM ubuntu:24.04
WORKDIR /app
# The agent gets a bare box. No node, no npm, no package manager for JS —
# the task says "no libraries", so we do not hand it any.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      wget gnupg fonts-liberation libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
      libcairo2 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir playwright==1.49.0 pillow==11.0.0 \
      "harbor-rewardkit[all]==0.1.*" \
    && playwright install chromium
COPY . /tests
RUN chmod +x /tests/test.sh
WORKDIR /tests

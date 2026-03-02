FROM node:20-slim

RUN apt-get update && apt-get install -y \
  chromium \
  ffmpeg \
  fonts-liberation \
  fonts-noto-color-emoji \
  libgbm1 \
  libnss3 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libcups2 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libgtk-3-0 \
  libasound2 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json /app/package.json
RUN npm install --production
COPY server.js /app/server.js

EXPOSE 3000
CMD ["node", "/app/server.js"]

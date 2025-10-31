FROM node:18-bullseye

# Install Chromium and dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libc6 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=5000

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production
COPY . .

EXPOSE 5000
CMD ["node", "server/index.js"]



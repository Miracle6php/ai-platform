# ---- Stage 1: build the JS bundle ----
FROM node:20-slim AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm install

COPY js/ ./js/
RUN npm run build:live


# ---- Stage 2: your existing PHP app ----
FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    && docker-php-ext-install mysqli curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Overwrite js/live.bundle.js with the freshly built one from Stage 1
COPY --from=build /build/js/live.bundle.js ./js/live.bundle.js

CMD php -S 0.0.0.0:$PORT -t .
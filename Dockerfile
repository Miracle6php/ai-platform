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
    ffmpeg \
    && docker-php-ext-install mysqli curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# FIX: PHP's default upload_max_filesize (2MB) and post_max_size (8MB)
# were rejecting video uploads, since the app allows up to 10MB videos
# plus a reference image on top of that. This was surfacing to the
# browser as a dropped connection ("Could not connect to the AIStudio
# server") rather than a clean error, because PHP's built-in dev
# server can close the connection mid-upload once the limit is hit,
# before the client finishes sending -- the browser reads that as a
# network failure (xhr.onerror), not a normal HTTP error response.
RUN { \
    echo 'upload_max_filesize = 20M'; \
    echo 'post_max_size = 25M'; \
    echo 'max_execution_time = 300'; \
    echo 'max_input_time = 300'; \
    echo 'memory_limit = 256M'; \
} > /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /app
COPY . .

# Overwrite js/live.bundle.js with the freshly built one from Stage 1
COPY --from=build /build/js/live.bundle.js ./js/live.bundle.js

CMD php -S 0.0.0.0:$PORT -t .
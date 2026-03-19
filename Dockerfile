# ── Stage 1: Build the frontend ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Serve the web version ───────────────────────────────────────────
# Note: Tauri's native .exe cannot run in Docker (it needs a Windows host).
# This Docker image serves GitLane as a WEB APP only.
# The .exe desktop version is built with: npm run tauri build
FROM nginx:alpine AS web-server

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Custom nginx config for single-page app routing
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
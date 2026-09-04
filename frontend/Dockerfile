# cordele-web (Angular / Nx) — production build served by nginx.
# Build context is `frontend/` (this directory).
#
# Why nginx instead of `serve`:
#   `serve -s` only does SPA fallback; it cannot forward /api/v1/* calls to the
#   backend services.  nginx handles both static files and reverse-proxy routing
#   in the same container, with no extra service required.  See nginx.conf for
#   routing details (one location block per backend service + SPA fallback).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npx nx build cordele-web --configuration=production

FROM nginx:1.27-alpine AS runtime
# Copy the Angular SPA output to nginx's default document root
COPY --from=build /app/dist/apps/cordele-web/browser /usr/share/nginx/html
# Replace the default nginx virtual-host with our proxy + SPA config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4500
CMD ["nginx", "-g", "daemon off;"]

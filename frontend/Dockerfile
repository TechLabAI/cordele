# cordele-web (Angular / Nx) — production-style static build served by `serve`.
# Build context is `frontend/` (this directory).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npx nx build cordele-web --configuration=production

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist/apps/cordele-web/browser ./browser
EXPOSE 4500
# -s enables SPA fallback (all unmatched routes resolve to index.html),
# required for Angular client-side routing.
CMD ["serve", "-s", "browser", "-l", "4500"]

# GWAVE STRIKE — one container: Colyseus game server + built web client.
# Runs on the app EC2 box as `strike` (127.0.0.1:8095), behind Caddy's
# `handle_path /strike/*`. Built and deployed by
# .github/workflows/deploy-strike.yml (ECR → SSM), mirroring the metaverse
# server's pipeline.

FROM node:22-alpine AS build
WORKDIR /app
# Workspace manifests first so `npm ci` layer-caches across code-only changes.
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci
COPY . .
# shared (tsc) → client (vite, base=/strike/) → server (tsc)
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8095 \
    STATIC_DIR=/app/client/dist
# Full tree copy keeps the workspace symlinks (node_modules/@gwave-strike/*)
# intact — a pruned copy has broken them before and is not worth the ~100 MB.
COPY --from=build /app /app
EXPOSE 8095
CMD ["node", "server/dist/index.js"]

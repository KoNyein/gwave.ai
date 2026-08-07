# Gwave Open World — one container, two processes:
#   :8787 ws game server (server-authoritative PvP, Cognito JWT auth)
#   :8788 stats REST API (kill/XP → RDS game.* tables, memory fallback)
# Runs on the app EC2 box as `world` behind Caddy's /world-ws + /world-stats
# routes. Built and deployed by .github/workflows/deploy-world.yml
# (ECR → SSM), mirroring the strike pipeline.

FROM node:22-alpine
WORKDIR /app

COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev
COPY api/package.json api/package-lock.json api/
RUN cd api && npm ci --omit=dev

COPY server/server.js server/
COPY api/server.js api/

ENV NODE_ENV=production
EXPOSE 8787 8788

# Both processes in one container — either dying kills the container so
# docker's restart policy brings the pair back together. PORT is set
# per-process (api's default is 8790 — a shared PORT env would make the
# two processes fight over one port).
CMD ["sh", "-c", "PORT=8788 node api/server.js & PORT=8787 node server/server.js & wait -n"]

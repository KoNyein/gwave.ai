# gwave.ai IoT bridge — MQTT ⇄ gwave data API (PostgREST/RDS on AWS) relay.
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY index.mjs ./

USER node
CMD ["node", "index.mjs"]

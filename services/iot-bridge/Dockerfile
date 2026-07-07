# gwave.ai IoT bridge — MQTT ⇄ Supabase relay.
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY index.mjs ./

USER node
CMD ["node", "index.mjs"]

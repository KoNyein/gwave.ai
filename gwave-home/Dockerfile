# GWAVE Home/IoT platform — one container: REST API (:4000) + embedded MQTT
# broker (:1883). Runs on the app EC2 box as `gwave-home`, deployed by
# .github/workflows/gwave-home.yml (ECR → SSM), config via /etc/gwave-web.env
# (GH_* variables — see deploy/gwave-home/README.md).

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY db ./db
EXPOSE 4000 1883
CMD ["node", "src/server.js"]

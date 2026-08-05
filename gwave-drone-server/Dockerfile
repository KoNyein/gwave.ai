FROM node:22-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY start.js server.js api.js auth.js ./
COPY migrations ./migrations

EXPOSE 8787 8788
CMD ["node", "start.js"]

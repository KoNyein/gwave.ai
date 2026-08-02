# Gwave Metaverse WebSocket server.
#
# ★ ECS Fargate က linux/amd64 ပဲ run တယ် — M1/M2 Mac ကနေ build ရင်
#   `docker build --platform linux/amd64` မဖြစ်မနေ ထည့်ပါ။ မထည့်ရင် arm64
#   image ဖြစ်ပြီး task က "exec format error" နဲ့ ချက်ချင်းသေမယ်။
FROM node:20-alpine

# tini — PID 1 အနေနဲ့ node ကို တိုက်ရိုက် run ရင် SIGTERM ကို မှန်မှန်
# မလက်ခံဘူး၊ graceful shutdown က အလုပ်မလုပ်ဘဲ deploy တိုင်း connection
# တွေ ရုတ်တရက်ပြတ်မယ်။
RUN apk add --no-cache tini

WORKDIR /app

# Dependency layer ကို source နဲ့ ခွဲထား — code ပြောင်းရုံနဲ့ npm install
# ပြန်မလုပ်ရအောင်။
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Container ကိုယ်တိုင်ရဲ့ health check — ALB ရဲ့ check နဲ့ သီးခြား၊ ECS က
# task အဆင့်မှာ သိရအောင်။
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

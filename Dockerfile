# syntax=docker/dockerfile:1

# ---- Base -------------------------------------------------------------------
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ---- Builder ----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so any the
# browser needs (the data API, TURN for calls, CCTV player/HLS origins, VAPID
# push, maps, game frames) must be passed as build args here — not just at runtime.
#
# DATA_API_{URL,KEY} point at our self-hosted PostgREST + Realtime over RDS
# (https://gwave.cc/sb) — not Supabase, which gwave left on 2026-07-17. They were
# formerly named NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY; both
# spellings are accepted below (new name wins) so a builder that still passes only
# the old args produces a working image. Drop the legacy pair once every builder
# and env file sets the new names.
ARG NEXT_PUBLIC_DATA_API_URL
ARG NEXT_PUBLIC_DATA_API_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TURN_URL
ARG NEXT_PUBLIC_TURN_USERNAME
ARG NEXT_PUBLIC_TURN_CREDENTIAL
ARG NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_CCTV_PLAYER_ORIGIN
ARG NEXT_PUBLIC_CCTV_HLS_ORIGINS
ARG NEXT_PUBLIC_CCTV_APP
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GAME_FRAME_ORIGINS
ARG NEXT_PUBLIC_GPAY_KPAY_NUMBER
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_COGNITO_DOMAIN
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID
ARG NEXT_PUBLIC_S3_CDN
ENV NEXT_PUBLIC_DATA_API_URL=${NEXT_PUBLIC_DATA_API_URL:-$NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_DATA_API_KEY=${NEXT_PUBLIC_DATA_API_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}
# Legacy spellings kept in the build env so any straggling reference still
# resolves during `next build`. Remove together with the ARGs above.
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_TURN_URL=$NEXT_PUBLIC_TURN_URL
ENV NEXT_PUBLIC_TURN_USERNAME=$NEXT_PUBLIC_TURN_USERNAME
ENV NEXT_PUBLIC_TURN_CREDENTIAL=$NEXT_PUBLIC_TURN_CREDENTIAL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_CCTV_PLAYER_ORIGIN=$NEXT_PUBLIC_CCTV_PLAYER_ORIGIN
ENV NEXT_PUBLIC_CCTV_HLS_ORIGINS=$NEXT_PUBLIC_CCTV_HLS_ORIGINS
ENV NEXT_PUBLIC_CCTV_APP=$NEXT_PUBLIC_CCTV_APP
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GAME_FRAME_ORIGINS=$NEXT_PUBLIC_GAME_FRAME_ORIGINS
ENV NEXT_PUBLIC_GPAY_KPAY_NUMBER=$NEXT_PUBLIC_GPAY_KPAY_NUMBER
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_COGNITO_DOMAIN=$NEXT_PUBLIC_COGNITO_DOMAIN
ENV NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID
ENV NEXT_PUBLIC_S3_CDN=$NEXT_PUBLIC_S3_CDN
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- Runner -----------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

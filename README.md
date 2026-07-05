# gwave.ai

A Facebook-style social network super-app for growers, built as a single Next.js
14 application with Supabase as the backend.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** primitives
- **Zustand** for client state
- **Supabase** — Postgres (RLS), Auth, Storage, Realtime
- **next-intl** for i18n (English UI, Burmese `my` scaffolding)
- **pnpm** package manager
- Deployment: Docker (standalone output) via Coolify on AWS EC2

## Route groups

The app is organized with App Router route groups:

- `(auth)` — login / register
- `(social)` — feed and social features (Facebook-style app shell)
- `(tools)`, `(farm)`, `(pos)`, `(admin)`, `(dev)` — reserved for later phases

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase project URL and keys. See `.env.example` for the full list.
`SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose it to the client.

### 3. Apply database migrations

Migrations live in `supabase/migrations` as plain SQL. With the Supabase CLI:

```bash
supabase db reset   # local: applies migrations + seed
# or push to a linked project:
supabase db push
```

Demo data is in `supabase/seed/seed.sql`.

### 4. Run the dev server

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command          | Description                     |
| ---------------- | ------------------------------- |
| `pnpm dev`       | Start the dev server            |
| `pnpm build`     | Production build (standalone)   |
| `pnpm start`     | Serve the production build      |
| `pnpm lint`      | ESLint                          |
| `pnpm typecheck` | `tsc --noEmit`                  |
| `pnpm format`    | Prettier                        |

## Docker

Build and run the production container locally:

```bash
docker compose up --build
```

The `Dockerfile` is multi-stage and emits a standalone Next.js server. Public
`NEXT_PUBLIC_*` variables are inlined at build time via build args.

## Roles & access control

Roles are stored in `profiles.role` (`user`, `member`, `moderator`, `developer`,
`admin`, `super_admin`) and enforced by Postgres RLS plus the `requireRole()`
server helper in `src/lib/auth.ts`. Privileged operations use the service role
key only from server actions / route handlers (`src/lib/supabase/admin.ts`).

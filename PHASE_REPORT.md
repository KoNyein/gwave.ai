# Phase 0 — Foundation

This phase scaffolds the gwave.ai super-app and delivers authentication, the
profiles data model, the Facebook-style app shell, and the deployment/CI
pipeline.

## What was built

### Project scaffold

- Next.js 14 App Router with TypeScript **strict mode** (`noUncheckedIndexedAccess`
  enabled) and the `@/*` path alias.
- Tailwind CSS with brand design tokens exposed as CSS variables and Tailwind
  colors:
  - primary `#3B6D11`, accent `#639922`, tint `#EAF3DE`, text `#173404`.
- shadcn/ui primitives (`button`, `input`, `textarea`, `label`, `avatar`, `card`,
  `dropdown-menu`) in `src/components/ui`.
- Zustand, `next-intl`, ESLint (next config) and Prettier (+ tailwind plugin)
  configured. pnpm as the package manager.
- Route groups created: `(auth)`, `(social)`; plus `onboarding` and the OAuth
  `auth/callback` route handler. `(tools)`, `(farm)`, `(pos)`, `(admin)`, `(dev)`
  are reserved for later phases.

### Supabase integration

- Three clients, each with a clear trust boundary:
  - `src/lib/supabase/client.ts` — browser (anon key, RLS applies).
  - `src/lib/supabase/server.ts` — server components / actions / routes.
  - `src/lib/supabase/admin.ts` — **service role, bypasses RLS**, `server-only`.
- `src/lib/env.ts` validates public env vars with Zod; the service role key is
  read lazily via `getServiceRoleKey()` and throws if used where absent.
- Session refresh + route protection in `src/middleware.ts` /
  `src/lib/supabase/middleware.ts`.

### Auth flow

- Email/password sign-up and login, and Google OAuth, via server actions in
  `src/app/(auth)/actions.ts`.
- `auth/callback` exchanges the OAuth code and routes new users to onboarding.
- Profile onboarding (username, full name, avatar URL, bio) with Zod validation
  and a friendly duplicate-username error.
- `requireUser()` / `requireRole()` / `hasRole()` helpers in `src/lib/auth.ts`
  with a hierarchical role ranking.

### App shell (Facebook-style, responsive)

- Sticky top navbar: logo, global search input, primary nav icons, messages &
  notifications, language switcher, and a profile dropdown (profile / settings /
  logout).
- Left sidebar (profile + full nav) shown on `lg+`.
- Center feed column with a post composer placeholder and empty state.
- Right sidebar (suggestions + contacts) shown on `xl+`.
- Mobile bottom nav for small screens.

### i18n

- `next-intl` without a locale URL prefix; locale stored in a cookie and
  switchable from the navbar.
- `en` (default) and `my` (Burmese) message catalogs in `src/messages`.

### Deployment & CI

- Multi-stage `Dockerfile` emitting Next.js **standalone** output; runs as a
  non-root user.
- `docker-compose.yml` for local container runs.
- `.env.example` documenting all variables.
- GitHub Actions workflow (`.github/workflows/ci.yml`) running lint, typecheck
  and build on push/PR.

## Migrations added

- `supabase/migrations/20260705000000_init_profiles.sql`
  - `user_role` enum (`user` … `super_admin`).
  - `profiles` table (FK to `auth.users`, unique username, role default `user`).
  - `updated_at` trigger and a `handle_new_user()` trigger that auto-creates a
    profile row on signup.
  - RLS enabled with policies: authenticated users can read all profiles; a user
    may insert/update only their own row and **cannot escalate their own role**.
- `supabase/seed/seed.sql` — idempotent demo profiles.

## Quality gates

All pass locally:

```bash
pnpm typecheck   # tsc --noEmit — OK
pnpm lint        # next lint — no warnings or errors
pnpm build       # next build — compiled successfully (standalone)
```

## How to test manually

1. `pnpm install`, then `cp .env.example .env.local` and fill in Supabase values.
2. Apply the migration to your Supabase project (`supabase db push` or run the
   SQL file), and enable the Google provider in Supabase Auth if testing OAuth.
   Add `http://localhost:3000/auth/callback` to the allowed redirect URLs.
3. `pnpm dev`, open http://localhost:3000 → redirected to `/login`.
4. Register with email/password → redirected to `/onboarding` → set a username →
   land on `/feed` inside the app shell.
5. Verify: navbar search + icons, left/right sidebars on wide screens, mobile
   bottom nav on narrow screens, language toggle (EN/မြန်မာ), and logout from the
   profile menu.
6. Confirm protected routes: visiting `/feed` while logged out redirects to
   `/login?redirectTo=/feed`.

## Notes / follow-ups for later phases

- Reserved route groups `(tools)`, `(farm)`, `(pos)`, `(admin)`, `(dev)` are not
  yet populated.
- Global search is a UI input only; wiring it to the knowledge search is Phase 2.
- Storage buckets for avatars are not yet provisioned (avatar is a URL for now).

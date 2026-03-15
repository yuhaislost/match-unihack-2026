# CLAUDE.md

## Project Overview

Match is an MVP sports matching social network for **badminton**. It connects players of similar skill levels to each other and to nearby venues, handling matchmaking, court booking, and payment splitting. The app has two core flows: **Quick Match** (real-time "play now" matching with a dual-path system and scoring algorithm) and **Schedule Match** (open lobby sessions for future games with auto-fill). Venue merchants list courts, manage availability, and offer upsells (equipment, refreshments) — receiving payouts via Stripe Connect minus commission. The UI is **mobile-viewport only** (max ~430px), built as a responsive web app.

## Commands
```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Check code quality with Biome
npm run format   # Auto-format code with Biome
```

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router)
- **API:** tRPC 11 + TanStack React Query (type-safe RPC)
- **Database:** Supabase (Postgres) + Prisma ORM
- **Auth:** Supabase Auth (Google & Apple social login only)
- **Real-time:** Supabase Realtime (WebSocket — chat, queue updates, live feed)
- **Storage:** Supabase Storage (avatars, venue photos, upsell images)
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix Primitives)
- **Validation:** Zod (shared client/server schemas)
- **Forms:** React Hook Form + @hookform/resolvers
- **Maps:** Mapbox GL JS
- **Date/Time:** date-fns
- **Payments:** Stripe (Checkout, Connect, webhooks)
- **Push Notifications:** Web Push API via service workers
- **AI:** OpenAI Agent SDK (TypeScript)
- **Code Quality:** Biome

## Architecture & Directory Structure

```
src/
├── app/                          # Next.js App Router (pages, layouts, route handlers)
│   ├── api/trpc/[trpc]/route.ts  #   tRPC HTTP handler
│   ├── api/webhooks/             #   Stripe & other webhook endpoints
│   ├── (auth)/                   #   Auth routes (login, onboarding)
│   ├── (player)/                 #   Player-facing routes (explore, sessions, profile)
│   ├── (merchant)/               #   Merchant-facing routes (dashboard, courts, upsells)
│   ├── layout.tsx                #   Root layout (providers, global styles)
│   └── globals.css               #   Tailwind global styles
│
├── components/                   # React components
│   ├── ui/                       #   shadcn/ui primitives (Button, Card, Sheet, etc.)
│   └── [feature]/                #   Feature folders (see UI guidelines below)
│       ├── feature-name.tsx      #     Main component
│       ├── feature-name.test.tsx #     Co-located test
│       ├── use-feature-name.ts   #     Feature-specific hook (if needed)
│       └── types.ts              #     Feature-specific types (if needed)
│
├── hooks/                        # App-wide React hooks (client-only)
│                                 #   e.g. use-geolocation.ts, use-auth.ts, use-realtime.ts
│                                 #   Only for hooks shared across multiple features.
│
├── schemas/                      # Shared Zod schemas (importable from client & server)
│                                 #   One file per domain: session.ts, player.ts, venue.ts, booking.ts
│
├── use-cases/                    # Orchestration layer (server-only)
│                                 #   Coordinates multiple services for a single user action.
│                                 #   e.g. complete-booking.ts, confirm-quick-match.ts
│
├── lib/                          # Server & shared utilities
│   ├── prisma.ts                 #   Singleton Prisma client
│   ├── supabase.ts               #   Supabase adapter (auth, realtime, storage helpers)
│   ├── stripe.ts                 #   Stripe adapter (checkout, connect, payout helpers)
│   ├── openai.ts                 #   OpenAI adapter
│   └── services/                 #   Domain services (server-only, single-responsibility)
│       ├── matching.ts           #     Scoring algorithm, queue management, auto-fill
│       ├── session.ts            #     Session lifecycle (create, join, cancel, complete)
│       ├── booking.ts            #     Venue booking, payment splitting, refunds
│       ├── chat.ts               #     Message persistence, realtime channel management
│       ├── notification.ts       #     Push notification dispatch
│       └── review.ts             #     Ratings & reviews
│
├── trpc/                         # tRPC layer
│   ├── init.ts                   #   tRPC initialisation & context
│   ├── routers/                  #   Thin routers (see service layering below)
│   │   ├── _app.ts               #     Root router (merges all sub-routers)
│   │   ├── session.ts            #     Session CRUD & lifecycle mutations
│   │   ├── matching.ts           #     Quick Match queue, scoring, confirmation
│   │   ├── venue.ts              #     Venue discovery, court availability
│   │   ├── booking.ts            #     Checkout, payment, refund
│   │   ├── chat.ts               #     Message history (realtime handled by Supabase)
│   │   ├── player.ts             #     Profile, stats, preferences
│   │   └── review.ts             #     Rating submission & retrieval
│   ├── client.tsx                #   Client-side tRPC provider
│   ├── server.tsx                #   Server-side tRPC caller
│   └── query-client.ts           #   TanStack Query client config
│
├── generated/                    # Auto-generated (gitignored)
│   └── prisma/                   #   Prisma client types
│
└── types/                        # Cross-cutting TypeScript types not covered by Zod or Prisma

```

### Service Layering

The backend has three layers. Code flows **downward only** — a layer can call the layer below it but never above.

```
tRPC Routers          → Auth, input validation, call use-case or service, return result
    ↓
Use-Cases             → Orchestrate multiple services for one user action
    ↓
Services              → Single-responsibility domain logic, independent of each other
    ↓
Adapters (lib/*.ts)   → Thin wrappers around external SDKs (Stripe, Supabase, OpenAI)
```

**Routers** (`src/trpc/routers/`):
- Validate input using shared Zod schemas from `@/schemas/*`
- Check auth/permissions via tRPC context middleware
- Call a **use-case** (for multi-step operations) or a **service** directly (for simple CRUD)
- Return the result — no business logic here

**Use-cases** (`src/use-cases/`):
- Orchestrate multiple services for a single user action. E.g. `confirmQuickMatch()` calls `matching.confirmPair()`, then `session.create()`, then `notification.send()`, then `chat.createGroupChannel()`.
- Import `server-only`. Export plain async functions.
- May call multiple services, but **services never call other services or use-cases**.

**Services** (`src/lib/services/`):
- Single-responsibility domain logic. Each service owns one bounded context.
- Import `server-only`. Export plain async functions (not classes).
- Accept plain arguments — never tRPC context, never request objects.
- Call **adapters** for external dependencies, never import SDKs directly.
- Services are **independent of each other** — they never import another service. If an operation needs two services, it belongs in a use-case.

**Adapters** (`src/lib/*.ts` — e.g. `stripe.ts`, `supabase.ts`, `openai.ts`):
- Thin wrapper modules around external SDKs. Initialise the client, export typed helper functions.
- Services call adapter functions (e.g. `createCheckoutSession()`, `uploadFile()`) — they never import `stripe` or `@supabase/supabase-js` directly.
- Adapters do not contain business logic. They translate between our domain types and the SDK's API.

### UI Component Guidelines

**Server vs. client components:**
- **Server components by default.** Pages, layouts, and data-fetching wrappers are server components.
- Add `'use client'` only when the component needs interactivity: state, effects, event handlers, browser APIs (geolocation, WebSocket), or third-party client libraries (Mapbox, React Hook Form).
- Prefer pushing `'use client'` as far down the tree as possible. A page can be a server component that renders a client-only interactive child.

**Component structure:**
- `src/components/ui/` — shadcn/ui primitives only. Never put app-specific code here.
- `src/components/[feature]/` — domain-specific feature folders (e.g. `hero-card/`, `session-feed/`, `venue-card/`, `chat/`).

**Colocation (hybrid model):**
- Feature-specific hooks, types, and tests live **inside the feature folder** (e.g. `components/hero-card/use-hero-card.ts`, `hero-card.test.tsx`).
- App-wide hooks shared across multiple features live in `src/hooks/` (e.g. `use-geolocation.ts`, `use-auth.ts`).
- Cross-cutting types live in `src/types/`. Feature-local types stay in the feature folder.

**When to create a component vs. inline JSX:**
- Extract a component when the JSX is **reused in more than one place**, or when it has **its own state/logic** that would clutter the parent.
- If it's a one-off block of markup with no state, leave it inline. Don't extract for extraction's sake.

**Data fetching:**
- The default pattern is **server prefetch → `HydrateClient` → client `useSuspenseQuery`/`useQuery`**. Server components prefetch into the React Query cache; client components consume from it. See "API & Data Flow Patterns" below.
- Client components access tRPC via the `useTRPC()` hook from `@/trpc/client`, then call `.queryOptions()` / `.mutationOptions()` with React Query hooks.
- Components may also receive data as **props** from parent server components when appropriate.
- Exception: client components that subscribe to real-time channels (chat, queue updates) manage their own subscriptions internally.

**Route groups:**
- `(auth)`, `(player)`, `(merchant)` route groups separate pages by user role without affecting URL structure.
- Shared layouts per role group handle role-specific navigation, guards, and providers.

## API & Data Flow Patterns

There is **one data-fetching path**: tRPC. All reads and writes — whether from a server component, a client component, or a webhook — go through the service layering described above. This keeps auth, validation, and logging in one place.

> **Full reference:** See `_docs/trpc-usage.md` for comprehensive patterns, all 6 usage patterns with code examples, and do/don't rules.

### Hydration Boundary Pattern (primary)

The default data-fetching pattern is **server prefetch → hydrate → client consume**. Server components prefetch data into the React Query cache, `HydrateClient` serializes it to the client, and client components read from cache instantly.

```tsx
// Server component (page) — prefetch data
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function Page() {
  prefetch(trpc.venue.listNearby.queryOptions({ lat: 0, lng: 0, radius: 10 }));
  return (
    <HydrateClient>
      <ClientComponent />
    </HydrateClient>
  );
}
```

```tsx
// Client component — consume prefetched data (no loading state on first render)
"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function ClientComponent() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.venue.listNearby.queryOptions({ lat: 0, lng: 0, radius: 10 })
  );
  return <div>{data.name}</div>;
}
```

### Data Fetching Summary

| Context | How to fetch | Example |
|---|---|---|
| **Server → Client hydration** (default) | `prefetch()` + `<HydrateClient>` on server, `useSuspenseQuery`/`useQuery` on client | See above |
| **Server-only data** | Direct call via `await trpc.<proc>()` (does NOT hydrate to client) | `const data = await trpc.venue.getById({ id });` |
| **Client-only query** | `useTRPC()` + `useQuery` (no server prefetch) | `const { data } = useQuery(trpc.venue.listNearby.queryOptions(...))` |
| **Mutation (client)** | `useTRPC()` + `useMutation` | `useMutation(trpc.booking.create.mutationOptions())` |
| **Webhook handler** | Call use-case functions directly (skip tRPC) | `await completeBooking(event.data)` |
| **Real-time updates** | Supabase Realtime channels → local React state (not tRPC cache) | See Real-time section below |

### Key imports

| File | Exports | Used in |
|---|---|---|
| `@/trpc/server` | `trpc`, `HydrateClient`, `prefetch`, `getQueryClient` | Server components only |
| `@/trpc/client` | `useTRPC`, `TRPCReactProvider` | Client components only |

### Rules
- **Always wrap** client components consuming prefetched data in `<HydrateClient>`.
- **Match inputs exactly** between `prefetch(trpc.x.queryOptions(input))` on server and `useQuery(trpc.x.queryOptions(input))` on client — mismatched inputs cause a fresh fetch instead of a cache hit.
- **Use `useTRPC()`** hook in client components to get the typed proxy — never construct query keys manually.
- **Use `queryOptions()` / `mutationOptions()`** — never pass raw query keys to React Query hooks.
- Never import `@/trpc/server` from client code (build error via `"server-only"`).
- Never import `@/trpc/client` from server code (it's `"use client"`).
- Never query Prisma directly from a server component or client code. Always go through a tRPC procedure.
- Never use the Supabase JS client for CRUD reads/writes. Supabase is used for **auth**, **realtime**, and **storage** only. All database access goes through Prisma via tRPC.

## Stripe Integration Patterns

**Webhook endpoints** live at `src/app/api/webhooks/stripe/route.ts`. This is a raw Next.js route handler (not tRPC).

**Webhook handling flow:**
1. Route handler reads the raw request body and verifies the Stripe signature using the `stripe.webhooks.constructEvent()` adapter helper.
2. Switch on `event.type` and call the appropriate **use-case function** directly. Webhooks skip tRPC entirely — Stripe's signature verification is the auth.
3. Return `200` immediately. If the use-case fails, return `500` so Stripe retries.

**Key webhook events to handle:**
- `checkout.session.completed` → `completeBooking()` use-case
- `account.updated` → update merchant Stripe Connect onboarding status
- `charge.refunded` → `processRefund()` use-case

**Stripe Connect onboarding (merchants):**
1. Merchant signs up → app creates a Stripe Connect account via the adapter (`createConnectAccount()`).
2. App generates an account onboarding link (`createAccountLink()`) and redirects the merchant.
3. Merchant completes Stripe's hosted onboarding. Stripe fires `account.updated` webhook.
4. Webhook use-case updates the merchant record with `chargesEnabled: true`.

**Local development:**
- Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` to forward events locally.
- Store the webhook signing secret from `stripe listen` output in `.env.local` as `STRIPE_WEBHOOK_SECRET`.
- Use `stripe trigger checkout.session.completed` to test specific events.

## Real-time Implementation Guidance

Supabase Realtime is used for **three concerns**: chat messages, Quick Match queue updates, and live player counts. It is **not** used for CRUD — that goes through tRPC.

**Subscription pattern:**
- Each real-time feature gets a dedicated hook (e.g. `use-chat-channel.ts`, `use-queue-subscription.ts`) that manages its own Supabase channel.
- The hook subscribes on mount, pushes incoming events into **local React state** (via `useState` or `useReducer`), and unsubscribes on unmount via cleanup in `useEffect`.
- **Supabase Realtime never writes to the tRPC/React Query cache directly.** The two systems stay decoupled.

**Reconnection & sync:**
- On channel reconnect (after a disconnect), **invalidate the relevant tRPC query** to re-fetch the full state from the server. This prevents stale local state after a gap in the event stream.
- Use `channel.on('system', { event: 'reconnect' }, () => queryClient.invalidateQueries({ queryKey: [...] }))` to trigger this.

**Cleanup:**
- Always unsubscribe in the `useEffect` cleanup function. Leaking subscriptions will cause duplicate messages and memory leaks.
- Use a single channel per logical scope (e.g. one channel per chat room, one channel per Quick Match queue). Do not create multiple channels for the same data.

**Channel naming convention:** `{domain}:{id}` — e.g. `chat:session_abc123`, `queue:quickmatch`, `presence:players_nearby`.

## Authentication & Authorization Patterns

**Two layers of auth (defense in depth):**

**Layer 1 — tRPC middleware (primary):**
- A `protectedProcedure` middleware in `src/trpc/init.ts` extracts the Supabase session from the request, verifies it, and attaches `userId` and `role` (player/merchant) to the tRPC context.
- All authenticated procedures use `protectedProcedure` instead of `publicProcedure`.
- Role-specific procedures (e.g. merchant-only routes) use additional middleware: `merchantProcedure` checks `ctx.role === 'merchant'`.
- Public procedures (e.g. venue listing for unauthenticated browsing) use `publicProcedure` — explicitly chosen, never the default.

**Layer 2 — Supabase Row Level Security (safety net):**
- RLS policies are enabled on all tables as a defense-in-depth measure.
- Prisma connects with a **service-role key** that bypasses RLS. This means tRPC middleware is the primary enforcer — RLS is a backstop for bugs, not the primary gate.
- RLS policies should mirror the tRPC middleware logic: players can only read/write their own data, merchants can only manage their own venues, etc.
- When writing a new migration, always include the corresponding RLS policy.

**Auth flow:**
1. Client calls Supabase Auth (`signInWithOAuth` for Google/Apple).
2. Supabase returns a session JWT.
3. Client sends the JWT in tRPC request headers (via the tRPC client link configuration).
4. tRPC middleware verifies the JWT with `supabase.auth.getUser()` and populates `ctx.user`.

**Webhook auth:** Stripe webhooks do not use Supabase auth. They verify the `stripe-signature` header instead. Webhook route handlers are not protected by tRPC middleware.

## Error Handling Patterns

**Services return result objects — they never throw:**
```ts
// Service return type
type ServiceResult<T> = { success: true; data: T } | { success: false; error: string; code?: string };
```

**Routers inspect results and throw typed `TRPCError`:**
```ts
// In a tRPC router
const result = await createSession(input);
if (!result.success) {
  throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
}
return result.data;
```

**Error mapping convention:**

| Service error scenario | tRPC error code |
|---|---|
| Record not found | `NOT_FOUND` |
| User not allowed to perform action | `FORBIDDEN` |
| Invalid input that passed Zod (business rule) | `BAD_REQUEST` |
| External service failure (Stripe, Supabase) | `INTERNAL_SERVER_ERROR` |
| Auth missing or expired | `UNAUTHORIZED` |

**Client-side error handling:**
- tRPC's `onError` callback in the client link logs errors to the console in development.
- Components use React Query's `error` state from tRPC hooks to display user-facing messages.
- Next.js `error.tsx` boundaries catch unhandled errors at the page level.

**Webhook error handling:**
- Webhook handlers catch exceptions and return `500` so Stripe retries.
- Log the error with the Stripe event ID for debugging.

**Logging:**
- Use `console.error` for errors and `console.warn` for recoverable issues. No external logging service in the MVP.
- Always include context: `console.error('[booking.create]', { userId, venueId, error })`.

## Coding Conventions

**File naming:**
- All files use **kebab-case**: `use-geolocation.ts`, `quick-match.tsx`, `create-booking.ts`.
- Component files match their export name in kebab-case: `hero-card.tsx` exports `HeroCard`.

**Exports:**
- **Always named exports.** Never use `export default`. This ensures consistent imports and makes refactoring safer.
- **No barrel files** (`index.ts`). Import from the specific file: `import { HeroCard } from '@/components/hero-card/hero-card'`, not from an index.

**Imports:**
- Use the `@/*` path alias for all imports from `src/`. Never use relative paths that go above the current directory (no `../../`).
- Biome auto-organises imports on save. Do not manually sort.

**Naming conventions:**
- React components: `PascalCase` (`HeroCard`, `VenueCard`)
- Hooks: `camelCase` with `use` prefix (`useGeolocation`, `useAuth`)
- Plain functions (services, use-cases, utils): `camelCase` (`createSession`, `confirmQuickMatch`)
- Zod schemas: `camelCase` with `Schema` suffix (`createSessionSchema`, `playerProfileSchema`)
- Types/interfaces: `PascalCase` (`Session`, `PlayerProfile`, `ServiceResult`)
- Constants: `UPPER_SNAKE_CASE` (`AUTO_MATCH_THRESHOLD`, `CONFIRMATION_TIMEOUT_MS`)
- File-level enums: avoid — use Zod literals or union types instead

**Server-only enforcement:**
- Files in `src/lib/services/`, `src/use-cases/`, and `src/lib/*.ts` adapters must import `'server-only'` at the top. This causes a build error if client code accidentally imports them.

**CSS:**
- Use Tailwind utility classes directly in JSX. No custom CSS files beyond `globals.css`.
- Use `cn()` (from a `clsx` + `tailwind-merge` utility) for conditional class merging.

## Next.JS
- Please refer to the Next.JS MCP server when developing with the framework to ensure correct implementation.
- **Always use `<Link>` from `next/link`** for in-app navigation. Never use plain `<a>` tags for internal routes — they cause full page refreshes and break client-side navigation.
- The **splash screen** only appears at the root URL (`/`). It is the page content of `src/app/page.tsx`, not a `loading.tsx` boundary. Do not add a root `loading.tsx`.
- **Bottom tab navigation** uses the `BottomNav` client component (`src/components/nav/bottom-nav.tsx`). It uses `usePathname()` for active state and `<Link>` for instant client-side tab switching.

## Database
- Prisma schema at `prisma/schema.prisma` defines business models (Essay, UserPreferences, CustomRubric, etc.)
- Singleton Prisma client in `src/lib/prisma.ts` uses PrismaPg adapter for connection pooling
- Generated types output to `src/generated/prisma/` (gitignored)

## Documentation

- Specifications: `docs/specs/`
- Implementation notes: `docs/implementation/`
- When creating a new service or major feature, add or update the relevant implementation note.
- For any bug reports, please document it inside the docs folder with the solution and why it was chosen.

## Testing

- Tests use **Vitest** as the test runner
- Test files live alongside source files using the `*.test.ts` / `*.test.tsx` naming convention
- **Backend services** (`src/lib/`) should have unit tests that exercise business logic without tRPC or HTTP concerns. Mock external dependencies (database, APIs) at the boundary.
- **tRPC routers** generally do not need dedicated tests — test the underlying service instead. Integration tests for routers are acceptable for complex orchestration flows.
- **Frontend components** should have tests for non-trivial interaction logic. Purely presentational components rarely need tests.
- Run tests with `npm run test` (unit) or `npm run test:e2e` (end-to-end if configured)

## Database Migrations

- Use `npx prisma migrate dev --name <description>` for schema changes during development. This creates a migration file and applies it.
- Use `npx prisma db push` only for rapid prototyping — it does not create migration files and should not be used for changes intended to persist.
- After changing `prisma/schema.prisma`, always run `npx prisma generate` to regenerate the client types.
- Seed data (if any) lives in `prisma/seed.ts` and runs via `npx prisma db seed`.

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output CLAUDE.md|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-report-web-vitals.mdx,use-router.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
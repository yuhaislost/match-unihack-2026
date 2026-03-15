Phase 1 — Core Quick Match Flow: Complete                                                                                                                                                                          
                                                                                                                                                                                                                     
  What was implemented                                                                                                                                                                                               
                                                                                                                                                                                                                     
  1. gameType passthrough (was hardcoded to SINGLES)        
  - enqueue router now passes input.gameType → use-case → service
  - enqueue() service and enqueueAndAutoMatch() use-case accept gameType param
  - Sessions created with correct game type

  2. Lazy auto-match scanning (src/trpc/routers/matching.ts)
  - Every getQueueStatus poll (3s) now runs findAutoMatchCandidate() for SEARCHING players
  - If a compatible player is found above the 0.65 threshold, a SYSTEM_AUTO match request + session is created immediately
  - Returns CONFIRMING state directly — no extra round-trip needed
  - Also filters out expired queue entries (windowEnd) from candidate search

  3. Queue window expiry (src/trpc/routers/matching.ts)
  - When getQueueStatus detects windowEnd has passed, it dequeues the player and returns IDLE
  - Expired entries excluded from findCandidates() via windowEnd: { gt: new Date() } filter

  4. Supabase Realtime subscription (src/hooks/use-queue-subscription.ts)
  - New hook subscribes to postgres_changes on match_requests (requester/recipient) and session_players
  - Invalidates getQueueStatus query instantly on any change — no waiting for 3s poll
  - Singleton browser Supabase client (src/lib/supabase-browser.ts) prevents duplicate connections
  - Graceful fallback — polling still works without realtime

  5. Auto-expand on match found (src/components/hero-card/use-hero-card.ts)
  - Tracks previous server state; auto-expands hero card when transitioning to CONFIRMING or MATCHED
  - Ensures players never miss a match notification while card is collapsed

  6. Countdown expiry trigger (src/components/hero-card/use-hero-card.ts)
  - When client-side countdown hits 0, immediately invalidates getQueueStatus
  - Server runs expireTimedOutRequests() on next poll, cleaning up expired requests

  State machine analysis — all transitions verified

  ┌─────────────────────────────┬────────────────────────────┬─────────────────────────────────────┐
  │         Transition          │          Trigger           │               Status                │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ IDLE → CONFIGURE            │ Tap card                   │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ CONFIGURE → SEARCHING       │ "Find match" button        │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ CONFIGURE → IDLE            │ Cancel                     │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ SEARCHING → CONFIRMING      │ Auto-match found           │ ✅ New (lazy scan)                  │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ SEARCHING → PENDING_REQUEST │ Manual request sent        │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ SEARCHING → IDLE            │ Cancel/dequeue             │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ SEARCHING → IDLE            │ Window expires             │ ✅ New                              │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ PENDING_REQUEST → MATCHED   │ Recipient accepts manual   │ ✅ Existing (server)                │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ PENDING_REQUEST → SEARCHING │ Recipient declines/timeout │ ✅ Existing (server)                │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ PENDING_REQUEST → SEARCHING │ Cancel request             │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ CONFIRMING → MATCHED        │ Both accept (system auto)  │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ CONFIRMING → MATCHED        │ Accept (manual recipient)  │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ CONFIRMING → SEARCHING      │ Decline                    │ ✅ Existing                         │
  ├─────────────────────────────┼────────────────────────────┼─────────────────────────────────────┤
  │ CONFIRMING → SEARCHING      │ Timeout                    │ ✅ Existing + new countdown trigger │
  └─────────────────────────────┴────────────────────────────┴─────────────────────────────────────┘

  No existing transition behavior was changed.

                                                                                                                                                                                                                   
  Completed                                                                                       
  - Auth & Onboarding — Login (Google/Apple OAuth), role selection, player/merchant profile forms
  - Database — Full Prisma schema (24 tables, 18 enums), migrations applied                                                                                                                                          
  - tRPC Foundation — 5 procedure types, context, client/server setup
  - Design System — Dark theme tokens, Tailwind config, Ace mascot (static + animated)
  - Explore Screen — Mapbox map, bottom sheet, venue cards, session cards, player dots
  - Venue Detail — Full page with photos, courts, upsells, reviews
  - Basic Matching — Queue enqueue/dequeue, scoring algorithm, manual requests, cooldowns
  - Navigation — Bottom nav (player/merchant aware), splash screen
  -  Phase 1 — Core Quick Match Flow
    1. Real-time queue feed — Supabase Realtime channels for live player suggestions
    2. System auto-match scanning — Background polling to find auto-matches above 0.65 threshold
    3. Hero card state transitions — Full state machine (Idle → Configure → Searching → Pending → Confirmed → Venue Selection)
    4. Player locking during confirmation flows
    5. Queue expiry handling + notifications

  Remaining (by priority)

  Phase 2 — Venue Selection & Booking

  6. Venue proposal & voting — Ranked venue suggestions, voting flow, 15-min timeout
  7. Stripe Checkout — Payment intent, per-player splitting
  8. Stripe Connect — Merchant payouts, onboarding link generation
  9. Webhook handlers — checkout.session.completed, account.updated, charge.refunded

  Phase 3 — Social & Post-Game

  10. Chat system — Group chat auto-creation, Supabase Realtime messaging, read receipts
  11. Reviews & ratings — Post-game rating prompt, venue reviews, player sportsmanship ratings
  12. Push notifications — Service worker, Web Push API, event dispatch

  Phase 4 — Schedule Match

  13. Session creation endpoint + UI
  14. Join request flow with host approval
  15. Auto-fill safety net (1hr before start, sequential invites)

  Phase 5 — Player & Merchant Pages

  16. Player sessions page — Upcoming/past sessions list
  17. Player profile page — Stats, match history
  18. Merchant dashboard — Booking overview, revenue analytics
  19. Court management — CRUD + availability scheduling
  20. Upsell management — CRUD for add-on items

  Phase 6 — Polish

  21. Session detail view — Roster, receipt, chat, game timer
  22. Notification feed in-app
  23. Settings/preferences UI
  24. Tests — Unit tests for services, integration tests for key flows

  ---
  What would you like to tackle next?

   Phase 4: Schedule Match — Implementation Complete                                                                                                                                                                  
                                                                                                                                                                                                                     
  New Files (12)
                                                                                                                                                                                                                     
  ┌─────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                      File                       │                                                 Purpose                                                  │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/schemas/schedule-match.ts                   │ Zod schemas for all schedule match inputs                                                                │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/lib/services/schedule-match.ts              │ Domain logic — create, join, respond, cancel, leave, lobby, auto-fill                                    │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/use-cases/schedule-match.ts                 │ Orchestration layer — wraps service calls, runAutoFill() cron logic                                      │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/trpc/routers/schedule-match.ts              │ 8 tRPC procedures (create, join, respondToJoinRequest, getLobby, cancel, leave, respondToAutoFillInvite) │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/app/api/cron/autofill/route.ts              │ Cron endpoint — verifies CRON_SECRET, runs auto-fill                                                     │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/hooks/use-session-subscription.ts           │ Realtime hook — listens to session_players/match_requests/sessions changes                               │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/app/(player)/sessions/create/page.tsx       │ Create session page (server component)                                                                   │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/app/(player)/sessions/[id]/page.tsx         │ Session lobby page (server component with prefetch)                                                      │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/components/schedule/create-session-form.tsx │ Form: game type, date/time, skill range, auto-accept                                                     │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/components/schedule/session-lobby.tsx       │ Lobby: player roster, pending requests (creator), join/leave/cancel actions                              │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/components/schedule/join-request-card.tsx   │ Accept/decline card for join requests                                                                    │
  ├─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ src/components/schedule/sessions-list.tsx       │ Tabbed sessions list (Upcoming/Past) with create button                                                  │
  └─────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Modified Files (3)

  ┌────────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
  │                    File                    │                           Change                           │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ src/trpc/routers/_app.ts                   │ Registered scheduleMatch router                            │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ src/app/(player)/sessions/page.tsx         │ Replaced stub with sessions list + prefetch                │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
  │ src/components/explore/explore-content.tsx │ Added onClick navigation to SessionCard for /sessions/{id} │
  └────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘

                                                                                                                                                                                                                       
  Phase 2 — Venue Selection & Booking: Implementation Complete                                                                                                                                                       
                                                                                                                                                                                                                     
  New files created (8)
                                                                                                                                                                                                                     
  1. src/lib/stripe.ts — Stripe SDK adapter with helpers for checkout, webhooks, Connect, transfers, refunds
  2. src/schemas/booking.ts — Zod schemas for venue proposals, voting, checkout, booking queries
  3. src/lib/services/booking.ts — Booking domain service: create records, upsells, mark paid, merchant payouts, refunds, commission rate from SystemConfig
  4. src/use-cases/venue-selection.ts — Orchestrates init, propose, vote, timeout check, and state retrieval for venue selection
  5. src/use-cases/complete-booking.ts — Stripe Checkout initiation, webhook completion (mark paid + transfer to merchant), refund processing
  6. src/use-cases/stripe-connect.ts — Merchant onboarding and account.updated webhook handling
  7. src/trpc/routers/booking.ts — Booking router with initiateCheckout, getBooking, connectOnboard, connectStatus
  8. src/app/api/webhooks/stripe/route.ts — Stripe webhook handler for checkout.session.completed, account.updated, charge.refunded

  Modified files (9)

  1. package.json — Added stripe dependency
  2. src/lib/services/venue.ts — Added suggestVenuesForMidpoint() with midpoint calculation, distance/price/rating scoring
  3. src/lib/services/session.ts — Added setVenueSelectionDeadline() and confirmSessionVenue() helpers
  4. src/schemas/venue.ts — Added suggestVenuesForSessionSchema
  5. src/use-cases/quick-match.ts — Calls initVenueSelection() after both MANUAL_FEED accept and SYSTEM_AUTO mutual confirmation
  6. src/trpc/routers/session.ts — Added getVenueSelectionStatus, proposeVenue, voteOnProposal procedures
  7. src/trpc/routers/_app.ts — Merged booking: bookingRouter
  8. src/trpc/routers/matching.ts — Extended getQueueStatus to return VENUE_SELECTION (with proposals/votes/countdown) and BOOKED states, plus lazy timeout check
  9. src/components/hero-card/ — Updated types, hook, and component:
    - Added VENUE_SELECTION state: amber border, "Pick a venue" header, countdown, 3 compact venue cards with Confirm buttons and voting progress
    - Added BOOKED state: green border, venue info, "Pay $X.XX" button that redirects to Stripe Checkout
    - Added confirmVenue, rejectVenue, payNow actions
    - Auto-expand on transition to VENUE_SELECTION or BOOKED


Q: When a player taps a venue (from the map pin or feed card), how should the venue detail appear?
A: Bottom sheet expands to full height, replacing the feed but keeping the map peek-able

Q: How should available court times be presented on the venue detail screen?
A: List of available time slots for today, with a date picker to change days

Q: What actions should a player be able to take from the venue detail screen? (Select all that apply)
A: Book and create session — booking auto-creates a scheduled session others can join, Attach to existing session — player can link this venue to an active session they're in

Q: "Book and create session": After a player selects a court + time slot, how much session setup should they see before the session goes live?
A: Minimal — just game type (singles/doubles) and skill range, auto-fill the rest from the booking

Q: "Attach to existing session": How should the player pick which session to attach the venue to?
A: Both — show active Quick Match sessions at the top, then any other unbooked sessions below

Q: If a venue has multiple courts, how should the court + time slot selection work?
A: Single flat list of all available slots across all courts, grouped by time

Q: "Book and create session": When does payment happen? The creator is booking a court but the session isn't full yet.
A: Immediately at booking — the creating player pays the full amount upfront (split happens when others join)

Q: Where should upsell items (equipment rentals, refreshments) appear in this flow?
A: Separate step after selecting a time slot (checkout screen)

Q: How should pricing be displayed on the time slot list?
A: Show a single venue hourly rate at the top, time slots don't repeat the price

Screen 1 (Venue detail) — The bottom sheet expands to full height, with the map still peek-able at the top. Venue info (name, address, rating, hourly rate, court count) sits at the top, followed by a horizontal date strip and the time slot list grouped by time period (morning/afternoon/evening). Slots show the time and which court it's on. Taken slots are greyed out with strikethrough. The two action buttons sit at the bottom: "Book + create session" and "Attach to session."
Screen 2a (Book + create session) — A two-step flow on a single scrollable screen. Step 1 is the minimal session config: just game type (singles/doubles) and skill range chips. Date, time, and venue are pre-filled from the booking. Step 2 is checkout: upsells from the merchant, order summary showing the full court cost, and a clear note that the creator pays the full amount now and will be reimbursed when other players join.
Screen 2b (Attach to session) — Shows the player's active sessions that don't yet have a venue, with Quick Match sessions (in the venue selection phase) prioritised at the top with a blue accent. Scheduled sessions appear below. Sessions that already have a venue booked are hidden.
There are a few remaining logic questions about how these flows connect back to the matching system:The split/reimbursement question has real Stripe implementation implications — "immediately per joiner" requires Stripe transfers for each join event, while "only when full" is simpler but means the creator floats the cost longer. Worth thinking about what feels fair to the creator.

Q: When a player attaches a venue to an existing session, should the other players in the session need to confirm the venue choice?
A: Only for Quick Match sessions — Schedule Match sessions let the creator set the venue unilaterally

Q: "Book and create session": How does the cost split/reimbursement actually work when other players join later?
A: Only when the session is full — all joiners are charged their splits at once, creator reimbursed in bulk

Q: Should there be a time slot hold/reservation while the player is going through the checkout flow?
A: Yes — the slot is held for 10 minutes while the player completes session setup and checkout

 Implementation Complete

  DB Schema (Step 1)

  - CourtSlotHold model — 10-min slot holds with court/date/time/expiry
  - Booking.creatorId — tracks who paid upfront
  - BookingPlayerShare.isCreator — marks the upfront payer
  - Session.isVisible — hidden until payment confirmed for "Book + create"
  - Migration applied: 20260315002944_add_slot_holds_and_booking_creator

  New Services (Steps 2-3)

  - src/lib/services/court-availability.ts — getAvailableSlots, holdSlot, releaseHold, cleanExpiredHolds with slot grouping by morning/afternoon/evening
  - src/lib/services/booking.ts — added createCreatorBookingRecord (creator-pays-full)

  Modified Services (Step 4)

  - src/lib/services/session.ts — added createScheduleSessionFromBooking, makeSessionVisible, listEligibleSessionsForVenueAttach; filtered isVisible: true in listOpenSessions

  New Schemas (Step 5)

  - src/schemas/court-availability.ts, src/schemas/book-create-session.ts, src/schemas/attach-venue.ts

  New Use-Cases (Step 6)

  - src/use-cases/book-and-create-session.ts — hold slot → create invisible session → create booking → Stripe checkout
  - src/use-cases/attach-venue-to-session.ts — hold slot → SM creator auto-confirms, QM creates proposal with auto-vote
  - src/use-cases/complete-booking.ts — modified to call makeSessionVisible for book_create type

  Router Changes (Step 7)

  - venue router — added getAvailableSlots, holdSlot, releaseHold
  - session router — added listEligibleForVenueAttach, attachVenue
  - booking router — added bookAndCreateSession
  - matching router — VENUE_SELECTION state now returns pendingProposal for inline confirm

  UI Changes (Steps 8-11)

  - Bottom sheet — mode system (feed/venue-detail), auto-snaps to 95% for detail, back button
  - Explore content — venue clicks open in-sheet detail instead of navigating, handles ?venue= URL param
  - Venue detail sheet — venue info header, date picker, time slots, "Book + create" and "Attach to session" actions
  - Date picker strip — 14-day horizontal scrollable pills
  - Time slot list — grouped by morning/afternoon/evening, unavailable slots greyed/strikethrough
  - Book create flow — 2-step: game type + skill range → checkout summary
  - Attach session picker — lists eligible sessions (QM first with blue accent)
  - Hero card VENUE_SELECTION — replaced inline venue cards with "Browse venues" button + inline confirm for proposals from other player
  - Venue page — redirects to /explore?venue={id}


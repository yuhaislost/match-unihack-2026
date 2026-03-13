-- Enable RLS on all tables (standard Postgres, works everywhere)

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "merchant_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "venues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "court_availabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "upsell_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quick_match_queue_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decline_cooldowns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "venue_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "venue_proposal_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_player_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_upsells" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "merchant_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_read_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "venue_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_ratings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_config" ENABLE ROW LEVEL SECURITY;

-- RLS policies use auth.uid() which is Supabase-specific.
-- Wrap in a DO block that checks for the auth schema so the migration
-- passes cleanly on Prisma's shadow database (plain Postgres).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN

    -- ─── USERS ───
    CREATE POLICY "users_select_own" ON "users"
      FOR SELECT USING (auth_user_id = auth.uid());
    CREATE POLICY "users_update_own" ON "users"
      FOR UPDATE USING (auth_user_id = auth.uid());
    CREATE POLICY "users_insert_own" ON "users"
      FOR INSERT WITH CHECK (auth_user_id = auth.uid());

    -- ─── PLAYER PROFILES (public read, own write) ───
    CREATE POLICY "player_profiles_select_all" ON "player_profiles"
      FOR SELECT USING (true);
    CREATE POLICY "player_profiles_insert_own" ON "player_profiles"
      FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "player_profiles_update_own" ON "player_profiles"
      FOR UPDATE USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── MERCHANT PROFILES (public read, own write) ───
    CREATE POLICY "merchant_profiles_select_all" ON "merchant_profiles"
      FOR SELECT USING (true);
    CREATE POLICY "merchant_profiles_insert_own" ON "merchant_profiles"
      FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "merchant_profiles_update_own" ON "merchant_profiles"
      FOR UPDATE USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── VENUES (public read, owning merchant write) ───
    CREATE POLICY "venues_select_all" ON "venues"
      FOR SELECT USING (true);
    CREATE POLICY "venues_insert_merchant" ON "venues"
      FOR INSERT WITH CHECK (
        merchant_id IN (
          SELECT mp.id FROM "merchant_profiles" mp
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );
    CREATE POLICY "venues_update_merchant" ON "venues"
      FOR UPDATE USING (
        merchant_id IN (
          SELECT mp.id FROM "merchant_profiles" mp
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );

    -- ─── COURTS (public read, owning merchant write) ───
    CREATE POLICY "courts_select_all" ON "courts"
      FOR SELECT USING (true);
    CREATE POLICY "courts_insert_merchant" ON "courts"
      FOR INSERT WITH CHECK (
        venue_id IN (
          SELECT v.id FROM "venues" v
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );
    CREATE POLICY "courts_update_merchant" ON "courts"
      FOR UPDATE USING (
        venue_id IN (
          SELECT v.id FROM "venues" v
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );

    -- ─── COURT AVAILABILITIES (public read, owning merchant write) ───
    CREATE POLICY "court_availabilities_select_all" ON "court_availabilities"
      FOR SELECT USING (true);
    CREATE POLICY "court_availabilities_insert_merchant" ON "court_availabilities"
      FOR INSERT WITH CHECK (
        court_id IN (
          SELECT c.id FROM "courts" c
          JOIN "venues" v ON v.id = c.venue_id
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );
    CREATE POLICY "court_availabilities_update_merchant" ON "court_availabilities"
      FOR UPDATE USING (
        court_id IN (
          SELECT c.id FROM "courts" c
          JOIN "venues" v ON v.id = c.venue_id
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );

    -- ─── UPSELL ITEMS (public read, owning merchant write) ───
    CREATE POLICY "upsell_items_select_all" ON "upsell_items"
      FOR SELECT USING (true);
    CREATE POLICY "upsell_items_insert_merchant" ON "upsell_items"
      FOR INSERT WITH CHECK (
        venue_id IN (
          SELECT v.id FROM "venues" v
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );
    CREATE POLICY "upsell_items_update_merchant" ON "upsell_items"
      FOR UPDATE USING (
        venue_id IN (
          SELECT v.id FROM "venues" v
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );

    -- ─── SESSIONS (participants only) ───
    CREATE POLICY "sessions_select_participant" ON "sessions"
      FOR SELECT USING (
        creator_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        OR id IN (
          SELECT session_id FROM "session_players"
          WHERE player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );
    CREATE POLICY "sessions_insert_creator" ON "sessions"
      FOR INSERT WITH CHECK (
        creator_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "sessions_update_creator" ON "sessions"
      FOR UPDATE USING (
        creator_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── SESSION PLAYERS ───
    CREATE POLICY "session_players_select_participant" ON "session_players"
      FOR SELECT USING (
        session_id IN (
          SELECT s.id FROM "sessions" s
          WHERE s.creator_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
        OR player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "session_players_insert_own" ON "session_players"
      FOR INSERT WITH CHECK (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "session_players_update_own" ON "session_players"
      FOR UPDATE USING (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── QUICK MATCH QUEUE ENTRIES (own only) ───
    CREATE POLICY "queue_entries_select_own" ON "quick_match_queue_entries"
      FOR SELECT USING (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "queue_entries_insert_own" ON "quick_match_queue_entries"
      FOR INSERT WITH CHECK (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "queue_entries_update_own" ON "quick_match_queue_entries"
      FOR UPDATE USING (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── MATCH REQUESTS (own entries) ───
    CREATE POLICY "match_requests_select_own" ON "match_requests"
      FOR SELECT USING (
        requester_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        OR recipient_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "match_requests_insert_own" ON "match_requests"
      FOR INSERT WITH CHECK (
        requester_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "match_requests_update_own" ON "match_requests"
      FOR UPDATE USING (
        requester_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        OR recipient_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── DECLINE COOLDOWNS (own entries) ───
    CREATE POLICY "decline_cooldowns_select_own" ON "decline_cooldowns"
      FOR SELECT USING (
        player_a_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        OR player_b_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "decline_cooldowns_insert_own" ON "decline_cooldowns"
      FOR INSERT WITH CHECK (
        player_a_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── VENUE PROPOSALS (session participants) ───
    CREATE POLICY "venue_proposals_select_participant" ON "venue_proposals"
      FOR SELECT USING (
        session_id IN (
          SELECT sp.session_id FROM "session_players" sp
          WHERE sp.player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );
    CREATE POLICY "venue_proposals_insert_participant" ON "venue_proposals"
      FOR INSERT WITH CHECK (
        proposed_by_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── VENUE PROPOSAL VOTES (session participants) ───
    CREATE POLICY "venue_proposal_votes_select_participant" ON "venue_proposal_votes"
      FOR SELECT USING (
        proposal_id IN (
          SELECT vp.id FROM "venue_proposals" vp
          JOIN "session_players" sp ON sp.session_id = vp.session_id
          WHERE sp.player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );
    CREATE POLICY "venue_proposal_votes_insert_own" ON "venue_proposal_votes"
      FOR INSERT WITH CHECK (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── BOOKINGS (participants read, system write) ───
    CREATE POLICY "bookings_select_participant" ON "bookings"
      FOR SELECT USING (
        session_id IN (
          SELECT sp.session_id FROM "session_players" sp
          WHERE sp.player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
        OR venue_id IN (
          SELECT v.id FROM "venues" v
          JOIN "merchant_profiles" mp ON mp.id = v.merchant_id
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );

    -- ─── BOOKING PLAYER SHARES (own read) ───
    CREATE POLICY "booking_player_shares_select_own" ON "booking_player_shares"
      FOR SELECT USING (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── BOOKING UPSELLS (own read via share) ───
    CREATE POLICY "booking_upsells_select_own" ON "booking_upsells"
      FOR SELECT USING (
        booking_player_share_id IN (
          SELECT bps.id FROM "booking_player_shares" bps
          WHERE bps.player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );

    -- ─── MERCHANT PAYOUTS (owning merchant read) ───
    CREATE POLICY "merchant_payouts_select_merchant" ON "merchant_payouts"
      FOR SELECT USING (
        merchant_id IN (
          SELECT mp.id FROM "merchant_profiles" mp
          JOIN "users" u ON u.id = mp.user_id
          WHERE u.auth_user_id = auth.uid()
        )
      );

    -- ─── CHAT ROOMS (participants only) ───
    CREATE POLICY "chat_rooms_select_participant" ON "chat_rooms"
      FOR SELECT USING (
        id IN (
          SELECT cp.chat_room_id FROM "chat_participants" cp
          WHERE cp.user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );

    -- ─── CHAT PARTICIPANTS (room participants) ───
    CREATE POLICY "chat_participants_select_participant" ON "chat_participants"
      FOR SELECT USING (
        chat_room_id IN (
          SELECT cp2.chat_room_id FROM "chat_participants" cp2
          WHERE cp2.user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );

    -- ─── CHAT MESSAGES (room participants) ───
    CREATE POLICY "chat_messages_select_participant" ON "chat_messages"
      FOR SELECT USING (
        chat_room_id IN (
          SELECT cp.chat_room_id FROM "chat_participants" cp
          WHERE cp.user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );
    CREATE POLICY "chat_messages_insert_participant" ON "chat_messages"
      FOR INSERT WITH CHECK (
        sender_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        AND chat_room_id IN (
          SELECT cp.chat_room_id FROM "chat_participants" cp
          WHERE cp.user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
        )
      );

    -- ─── MESSAGE READ RECEIPTS (own only) ───
    CREATE POLICY "message_read_receipts_select_own" ON "message_read_receipts"
      FOR SELECT USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "message_read_receipts_insert_own" ON "message_read_receipts"
      FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── VENUE REVIEWS (public read, own write) ───
    CREATE POLICY "venue_reviews_select_all" ON "venue_reviews"
      FOR SELECT USING (true);
    CREATE POLICY "venue_reviews_insert_own" ON "venue_reviews"
      FOR INSERT WITH CHECK (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "venue_reviews_update_own" ON "venue_reviews"
      FOR UPDATE USING (
        player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── PLAYER RATINGS (public read, own write) ───
    CREATE POLICY "player_ratings_select_all" ON "player_ratings"
      FOR SELECT USING (true);
    CREATE POLICY "player_ratings_insert_own" ON "player_ratings"
      FOR INSERT WITH CHECK (
        rater_player_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── NOTIFICATIONS (own only) ───
    CREATE POLICY "notifications_select_own" ON "notifications"
      FOR SELECT USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "notifications_update_own" ON "notifications"
      FOR UPDATE USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── NOTIFICATION PREFERENCES (own only) ───
    CREATE POLICY "notification_preferences_select_own" ON "notification_preferences"
      FOR SELECT USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "notification_preferences_insert_own" ON "notification_preferences"
      FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );
    CREATE POLICY "notification_preferences_update_own" ON "notification_preferences"
      FOR UPDATE USING (
        user_id IN (SELECT id FROM "users" WHERE auth_user_id = auth.uid())
      );

    -- ─── SYSTEM CONFIG (authenticated read, no write via RLS) ───
    CREATE POLICY "system_config_select_authenticated" ON "system_config"
      FOR SELECT USING (auth.uid() IS NOT NULL);

  END IF;
END
$$;

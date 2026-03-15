-- AlterTable
ALTER TABLE "booking_player_shares" ADD COLUMN     "is_creator" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "creator_id" UUID;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "is_visible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "court_slot_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "court_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "held_by_id" UUID NOT NULL,
    "session_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "court_slot_holds_session_id_key" ON "court_slot_holds"("session_id");

-- CreateIndex
CREATE INDEX "court_slot_holds_court_id_date_start_time_idx" ON "court_slot_holds"("court_id", "date", "start_time");

-- CreateIndex
CREATE INDEX "court_slot_holds_expires_at_idx" ON "court_slot_holds"("expires_at");

-- AddForeignKey
ALTER TABLE "court_slot_holds" ADD CONSTRAINT "court_slot_holds_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_slot_holds" ADD CONSTRAINT "court_slot_holds_held_by_id_fkey" FOREIGN KEY ("held_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_slot_holds" ADD CONSTRAINT "court_slot_holds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

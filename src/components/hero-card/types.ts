import type { SkillLevel } from "@/generated/prisma/client";

export type PlayerInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  playerProfile: {
    skillLevel: SkillLevel;
    avgSportsmanshipRating: unknown;
  } | null;
};

export type VenueProposalInfo = {
  id: string;
  venueName: string;
  address: string;
  distance: number | null;
  hourlyRate: number | null;
  rank: number | null;
  status: string;
  photoUrl: string | null;
  avgRating: number;
  voteCount: number;
  totalPlayers: number;
  myVote: string | null;
};

export type HeroCardState =
  | { kind: "IDLE"; nearbyPlayerCount: number }
  | { kind: "CONFIGURE" }
  | {
      kind: "SEARCHING";
      queueEntryId: string;
      timeRemainingMs: number;
      nearbyPlayerCount: number;
    }
  | {
      kind: "PENDING_REQUEST";
      requestId: string;
      otherPlayer: PlayerInfo;
      timeRemainingMs: number;
    }
  | {
      kind: "CONFIRMING";
      requestId: string;
      otherPlayer: PlayerInfo;
      timeRemainingMs: number;
      myResponse: string;
      sessionId: string | null;
    }
  | {
      kind: "MATCHED";
      sessionId: string;
      players: Array<PlayerInfo & { role: string; status: string }>;
    }
  | {
      kind: "VENUE_SELECTION";
      sessionId: string;
      players: Array<PlayerInfo & { role: string; status: string }>;
      proposals: VenueProposalInfo[];
      pendingProposal: {
        id: string;
        venueName: string;
        address: string;
        hourlyRate: number | null;
      } | null;
      timeRemainingMs: number;
    }
  | {
      kind: "BOOKED";
      sessionId: string;
      players: Array<PlayerInfo & { role: string; status: string }>;
      venue: { name: string; address: string } | null;
      booking: {
        id: string;
        playerShareAmount: number;
        paymentStatus: string;
      } | null;
    };

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  createBookingRecord,
  MAX_VENUE_SUGGESTIONS,
  VENUE_SELECTION_TIMEOUT_MS,
} from "@/lib/services/booking";
import { enqueue } from "@/lib/services/matching";
import {
  confirmSessionVenue,
  setVenueSelectionDeadline,
} from "@/lib/services/session";
import { suggestVenuesForMidpoint } from "@/lib/services/venue";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function initVenueSelection(
  sessionId: string,
): Promise<ServiceResult<null>> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                playerProfile: {
                  select: { latitude: true, longitude: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }

    // Set venue selection deadline
    await setVenueSelectionDeadline(sessionId, VENUE_SELECTION_TIMEOUT_MS);

    // Collect player locations
    const locations = session.players
      .map((p) => ({
        lat: p.player.playerProfile?.latitude
          ? Number(p.player.playerProfile.latitude)
          : null,
        lng: p.player.playerProfile?.longitude
          ? Number(p.player.playerProfile.longitude)
          : null,
      }))
      .filter(
        (loc): loc is { lat: number; lng: number } =>
          loc.lat !== null && loc.lng !== null,
      );

    if (locations.length === 0) {
      return { success: true, data: null };
    }

    // Generate venue suggestions
    const suggestResult = await suggestVenuesForMidpoint(
      locations,
      MAX_VENUE_SUGGESTIONS,
    );
    if (!suggestResult.success) {
      // Non-fatal: venue selection proceeds without auto-suggestions
      console.warn("[venue-selection.initVenueSelection] No suggestions", {
        sessionId,
        error: suggestResult.error,
      });
      return { success: true, data: null };
    }

    // Create VenueProposal records for system suggestions
    const systemUserId = session.creatorId; // Use creator as the "proposed by" for system suggestions
    for (const suggestion of suggestResult.data) {
      await prisma.venueProposal.create({
        data: {
          sessionId,
          venueId: suggestion.venueId,
          courtId: suggestion.courtId,
          proposedById: systemUserId,
          rank: suggestion.rank,
          distanceToMidpoint: suggestion.distance,
          price: suggestion.hourlyRate,
          status: "PROPOSED",
        },
      });
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("[venue-selection.initVenueSelection]", {
      sessionId,
      error,
    });
    return { success: false, error: "Failed to initialize venue selection" };
  }
}

export async function proposeVenue(
  playerId: string,
  sessionId: string,
  venueId: string,
  courtId: string,
): Promise<ServiceResult<{ proposalId: string }>> {
  try {
    // Validate player is in session
    const sessionPlayer = await prisma.sessionPlayer.findFirst({
      where: { sessionId, playerId },
    });
    if (!sessionPlayer) {
      return {
        success: false,
        error: "Player not in session",
        code: "FORBIDDEN",
      };
    }

    // Validate venue & court exist
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { venue: true },
    });
    if (!court || court.venueId !== venueId || court.deletedAt) {
      return {
        success: false,
        error: "Invalid venue/court combination",
        code: "BAD_REQUEST",
      };
    }

    // Create proposal
    const proposal = await prisma.venueProposal.create({
      data: {
        sessionId,
        venueId,
        courtId,
        proposedById: playerId,
        price: court.hourlyRate,
        status: "PROPOSED",
      },
    });

    // Auto-cast CONFIRM vote from proposer
    await prisma.venueProposalVote.create({
      data: {
        proposalId: proposal.id,
        playerId,
        vote: "CONFIRM",
      },
    });

    // Check for unanimous confirmation
    await checkAndConfirmProposal(proposal.id, sessionId);

    return { success: true, data: { proposalId: proposal.id } };
  } catch (error) {
    console.error("[venue-selection.proposeVenue]", {
      playerId,
      sessionId,
      error,
    });
    return { success: false, error: "Failed to propose venue" };
  }
}

export async function voteOnProposal(
  playerId: string,
  proposalId: string,
  vote: "CONFIRM" | "REJECT",
): Promise<ServiceResult<{ confirmed: boolean }>> {
  try {
    const proposal = await prisma.venueProposal.findUnique({
      where: { id: proposalId },
      include: { session: { include: { players: true } } },
    });
    if (!proposal) {
      return {
        success: false,
        error: "Proposal not found",
        code: "NOT_FOUND",
      };
    }

    // Validate player is in session
    const isInSession = proposal.session.players.some(
      (p) => p.playerId === playerId,
    );
    if (!isInSession) {
      return {
        success: false,
        error: "Player not in session",
        code: "FORBIDDEN",
      };
    }

    // Upsert vote
    await prisma.venueProposalVote.upsert({
      where: {
        proposalId_playerId: { proposalId, playerId },
      },
      create: { proposalId, playerId, vote },
      update: { vote },
    });

    if (vote === "REJECT") {
      // Check if all players rejected — mark proposal as rejected
      const votes = await prisma.venueProposalVote.findMany({
        where: { proposalId },
      });
      const totalPlayers = proposal.session.players.length;
      const rejectCount = votes.filter((v) => v.vote === "REJECT").length;
      if (rejectCount >= totalPlayers) {
        await prisma.venueProposal.update({
          where: { id: proposalId },
          data: { status: "REJECTED" },
        });
      }
      return { success: true, data: { confirmed: false } };
    }

    // CONFIRM — check unanimity
    const confirmed = await checkAndConfirmProposal(
      proposalId,
      proposal.sessionId,
    );
    return { success: true, data: { confirmed } };
  } catch (error) {
    console.error("[venue-selection.voteOnProposal]", {
      playerId,
      proposalId,
      error,
    });
    return { success: false, error: "Failed to vote on proposal" };
  }
}

async function checkAndConfirmProposal(
  proposalId: string,
  sessionId: string,
): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { players: true },
  });
  if (!session) return false;

  const votes = await prisma.venueProposalVote.findMany({
    where: { proposalId },
  });
  const totalPlayers = session.players.length;
  const confirmCount = votes.filter((v) => v.vote === "CONFIRM").length;

  if (confirmCount < totalPlayers) return false;

  // Unanimous — confirm venue
  const proposal = await prisma.venueProposal.findUnique({
    where: { id: proposalId },
    include: {
      court: { select: { hourlyRate: true } },
    },
  });
  if (!proposal) return false;

  await prisma.venueProposal.update({
    where: { id: proposalId },
    data: { status: "CONFIRMED" },
  });

  // Reject all other proposals for this session
  await prisma.venueProposal.updateMany({
    where: { sessionId, id: { not: proposalId }, status: "PROPOSED" },
    data: { status: "REJECTED" },
  });

  await confirmSessionVenue(sessionId, proposal.venueId, proposal.courtId);

  // Create booking record
  const playerIds = session.players.map((p) => p.playerId);
  const now = new Date();
  const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1hr from now default
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1hr session

  await createBookingRecord({
    sessionId,
    venueId: proposal.venueId,
    courtId: proposal.courtId,
    startTime,
    endTime,
    playerIds,
    courtHourlyRate: Number(proposal.court.hourlyRate),
  });

  return true;
}

export async function checkVenueSelectionTimeout(
  sessionId: string,
): Promise<
  ServiceResult<{ timedOut: boolean; reEnqueuedPlayerIds: string[] }>
> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { players: true },
    });
    if (!session || !session.venueSelectionDeadline) {
      return {
        success: true,
        data: { timedOut: false, reEnqueuedPlayerIds: [] },
      };
    }

    if (new Date() < session.venueSelectionDeadline) {
      return {
        success: true,
        data: { timedOut: false, reEnqueuedPlayerIds: [] },
      };
    }

    // Timeout — cancel session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "CANCELLED",
        cancelReason: "Venue selection timed out",
      },
    });

    // Re-enqueue players with priority
    const reEnqueuedPlayerIds: string[] = [];
    for (const sp of session.players) {
      const result = await enqueue(
        sp.playerId,
        session.gameType as "SINGLES" | "DOUBLES",
      );
      if (result.success) {
        // Set priority flag
        await prisma.quickMatchQueueEntry.update({
          where: { id: result.data.id },
          data: { hasPriority: true },
        });
        reEnqueuedPlayerIds.push(sp.playerId);
      }
    }

    return {
      success: true,
      data: { timedOut: true, reEnqueuedPlayerIds },
    };
  } catch (error) {
    console.error("[venue-selection.checkVenueSelectionTimeout]", {
      sessionId,
      error,
    });
    return { success: false, error: "Failed to check venue selection timeout" };
  }
}

export async function getVenueSelectionState(
  sessionId: string,
  playerId: string,
): Promise<
  ServiceResult<{
    proposals: Array<{
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
    }>;
    timeRemainingMs: number;
  }>
> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        players: true,
        venueProposals: {
          where: { status: "PROPOSED" },
          include: {
            venue: {
              select: {
                name: true,
                address: true,
                photoUrls: true,
                avgRating: true,
              },
            },
            votes: true,
          },
          orderBy: { rank: "asc" },
        },
      },
    });

    if (!session) {
      return { success: false, error: "Session not found", code: "NOT_FOUND" };
    }

    const totalPlayers = session.players.length;
    const now = Date.now();
    const timeRemainingMs = session.venueSelectionDeadline
      ? Math.max(0, session.venueSelectionDeadline.getTime() - now)
      : 0;

    const proposals = session.venueProposals.map((p) => {
      const myVote = p.votes.find((v) => v.playerId === playerId);
      const confirmVotes = p.votes.filter((v) => v.vote === "CONFIRM").length;
      return {
        id: p.id,
        venueName: p.venue.name,
        address: p.venue.address,
        distance: p.distanceToMidpoint ? Number(p.distanceToMidpoint) : null,
        hourlyRate: p.price ? Number(p.price) : null,
        rank: p.rank,
        status: p.status,
        photoUrl: p.venue.photoUrls[0] ?? null,
        avgRating: Number(p.venue.avgRating),
        voteCount: confirmVotes,
        totalPlayers,
        myVote: myVote?.vote ?? null,
      };
    });

    return { success: true, data: { proposals, timeRemainingMs } };
  } catch (error) {
    console.error("[venue-selection.getVenueSelectionState]", {
      sessionId,
      error,
    });
    return { success: false, error: "Failed to get venue selection state" };
  }
}

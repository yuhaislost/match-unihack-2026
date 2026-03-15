import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import {
  CONFIRMATION_TIMEOUT_MS,
  findAutoMatchCandidate,
  findCandidates,
  getActiveQueueEntry,
  getQueuePlayerCount,
  getQueuePlayerLocations,
} from "@/lib/services/matching";
import { createQuickMatchSession } from "@/lib/services/session";
import {
  cancelRequestSchema,
  enqueueSchema,
  respondToRequestSchema,
  sendRequestSchema,
} from "@/schemas/matching";
import { listNearbyVenuesSchema } from "@/schemas/venue";
import {
  cancelManualRequest,
  dequeuePlayer,
  enqueueAndAutoMatch,
  expireTimedOutRequests,
  respondToRequest,
  sendManualRequest,
} from "@/use-cases/quick-match";
import {
  checkVenueSelectionTimeout,
  getVenueSelectionState,
} from "@/use-cases/venue-selection";
import { createTRPCRouter, playerProcedure } from "../init";

export const matchingRouter = createTRPCRouter({
  enqueue: playerProcedure
    .input(enqueueSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await enqueueAndAutoMatch(
        ctx.user.id,
        input.gameType,
        input.latitude,
        input.longitude,
      );
      if (!result.success) {
        throw new TRPCError({
          code: result.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error,
        });
      }
      return result.data;
    }),

  dequeue: playerProcedure.mutation(async ({ ctx }) => {
    const result = await dequeuePlayer(ctx.user.id);
    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error,
      });
    }
    return null;
  }),

  getQueueStatus: playerProcedure.query(async ({ ctx }) => {
    const playerId = ctx.user.id;

    // Lazy expire
    await expireTimedOutRequests();

    const queueEntry = await getActiveQueueEntry(playerId);

    // Get nearby player count (use player's profile location)
    const profile = await prisma.playerProfile.findUnique({
      where: { userId: playerId },
    });
    let nearbyPlayerCount = 0;
    if (profile?.latitude && profile?.longitude) {
      nearbyPlayerCount = await getQueuePlayerCount(
        Number(profile.latitude),
        Number(profile.longitude),
        profile.searchRadiusKm,
      );
    }

    if (!queueEntry) {
      return {
        state: "IDLE" as const,
        nearbyPlayerCount,
      };
    }

    const now = Date.now();

    // Check for PENDING request where this player is involved (SYSTEM_AUTO)
    const confirmingRequest = await prisma.matchRequest.findFirst({
      where: {
        type: "SYSTEM_AUTO",
        status: "PENDING",
        expiresAt: { gt: new Date() },
        OR: [{ requesterId: playerId }, { recipientId: playerId }],
      },
      include: {
        requester: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            playerProfile: {
              select: { skillLevel: true, avgSportsmanshipRating: true },
            },
          },
        },
        recipient: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            playerProfile: {
              select: { skillLevel: true, avgSportsmanshipRating: true },
            },
          },
        },
        session: {
          include: {
            players: {
              where: { playerId },
              select: { status: true },
            },
          },
        },
      },
    });

    if (confirmingRequest) {
      const otherPlayer =
        confirmingRequest.requesterId === playerId
          ? confirmingRequest.recipient
          : confirmingRequest.requester;

      const mySessionPlayer = confirmingRequest.session?.players[0];

      return {
        state: "CONFIRMING" as const,
        request: {
          id: confirmingRequest.id,
          type: confirmingRequest.type,
          compositeScore: confirmingRequest.compositeScore
            ? Number(confirmingRequest.compositeScore)
            : null,
        },
        otherPlayer,
        timeRemainingMs: Math.max(
          0,
          confirmingRequest.expiresAt.getTime() - now,
        ),
        myResponse: mySessionPlayer?.status ?? "PENDING",
        sessionId: confirmingRequest.sessionId,
      };
    }

    // Check for outgoing MANUAL_FEED request
    const outgoingRequest = await prisma.matchRequest.findFirst({
      where: {
        requesterId: playerId,
        type: "MANUAL_FEED",
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        recipient: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            playerProfile: {
              select: { skillLevel: true, avgSportsmanshipRating: true },
            },
          },
        },
      },
    });

    if (outgoingRequest) {
      return {
        state: "PENDING_REQUEST" as const,
        outgoingRequest: {
          id: outgoingRequest.id,
          compositeScore: outgoingRequest.compositeScore
            ? Number(outgoingRequest.compositeScore)
            : null,
        },
        otherPlayer: outgoingRequest.recipient,
        timeRemainingMs: Math.max(0, outgoingRequest.expiresAt.getTime() - now),
      };
    }

    // Check for incoming MANUAL_FEED request (player is recipient)
    const incomingRequest = await prisma.matchRequest.findFirst({
      where: {
        recipientId: playerId,
        type: "MANUAL_FEED",
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        requester: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            playerProfile: {
              select: { skillLevel: true, avgSportsmanshipRating: true },
            },
          },
        },
      },
    });

    if (incomingRequest) {
      return {
        state: "CONFIRMING" as const,
        request: {
          id: incomingRequest.id,
          type: incomingRequest.type,
          compositeScore: incomingRequest.compositeScore
            ? Number(incomingRequest.compositeScore)
            : null,
        },
        otherPlayer: incomingRequest.requester,
        timeRemainingMs: Math.max(0, incomingRequest.expiresAt.getTime() - now),
        myResponse: "PENDING" as const,
        sessionId: incomingRequest.sessionId,
      };
    }

    // Check for recently MATCHED session
    const matchedSession = await prisma.session.findFirst({
      where: {
        mode: "QUICK_MATCH",
        status: "MATCHED",
        players: { some: { playerId } },
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                playerProfile: {
                  select: { skillLevel: true, avgSportsmanshipRating: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (matchedSession) {
      // Check if venue selection is active
      if (matchedSession.venueSelectionDeadline) {
        // Check for timeout
        const timeoutResult = await checkVenueSelectionTimeout(
          matchedSession.id,
        );
        if (timeoutResult.success && timeoutResult.data.timedOut) {
          // Session cancelled, players re-enqueued — return SEARCHING
          return {
            state: "SEARCHING" as const,
            queueEntry: {
              id: "",
              gameType: matchedSession.gameType,
              createdAt: new Date().toISOString(),
            },
            timeRemainingMs: 0,
            nearbyPlayerCount,
          };
        }

        // Get venue selection state
        const venueState = await getVenueSelectionState(
          matchedSession.id,
          playerId,
        );
        if (venueState.success) {
          // Find a proposal from another player that needs this player's vote
          const pendingProposal = venueState.data.proposals.find(
            (p) =>
              p.myVote === null && p.voteCount > 0 && p.status === "PROPOSED",
          );

          return {
            state: "VENUE_SELECTION" as const,
            session: {
              id: matchedSession.id,
              gameType: matchedSession.gameType,
              players: matchedSession.players.map((p) => ({
                ...p.player,
                role: p.role,
                status: p.status,
              })),
            },
            proposals: venueState.data.proposals,
            pendingProposal: pendingProposal
              ? {
                  id: pendingProposal.id,
                  venueName: pendingProposal.venueName,
                  address: pendingProposal.address,
                  hourlyRate: pendingProposal.hourlyRate,
                }
              : null,
            timeRemainingMs: venueState.data.timeRemainingMs,
          };
        }
      }

      return {
        state: "MATCHED" as const,
        session: {
          id: matchedSession.id,
          gameType: matchedSession.gameType,
          players: matchedSession.players.map((p) => ({
            ...p.player,
            role: p.role,
            status: p.status,
          })),
        },
      };
    }

    // Check for BOOKED session (venue confirmed, awaiting payment)
    const bookedSession = await prisma.session.findFirst({
      where: {
        mode: "QUICK_MATCH",
        status: "BOOKED",
        players: { some: { playerId } },
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                playerProfile: {
                  select: { skillLevel: true, avgSportsmanshipRating: true },
                },
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            totalAmount: true,
            playerShares: {
              where: { playerId },
              select: { totalAmount: true, status: true },
            },
          },
        },
        venue: {
          select: { id: true, name: true, address: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (bookedSession) {
      const playerShare = bookedSession.booking?.playerShares[0];
      return {
        state: "BOOKED" as const,
        session: {
          id: bookedSession.id,
          gameType: bookedSession.gameType,
          players: bookedSession.players.map((p) => ({
            ...p.player,
            role: p.role,
            status: p.status,
          })),
        },
        venue: bookedSession.venue
          ? {
              name: bookedSession.venue.name,
              address: bookedSession.venue.address,
            }
          : null,
        booking: bookedSession.booking
          ? {
              id: bookedSession.booking.id,
              playerShareAmount: playerShare
                ? Number(playerShare.totalAmount)
                : 0,
              paymentStatus: playerShare?.status ?? "PENDING",
            }
          : null,
      };
    }

    // Check if queue entry has expired (window ended)
    if (queueEntry.windowEnd.getTime() <= now) {
      await dequeuePlayer(playerId);
      return {
        state: "IDLE" as const,
        nearbyPlayerCount,
      };
    }

    // Lazy auto-match scan — check for compatible players on each poll
    const candidate = await findAutoMatchCandidate(playerId);
    if (candidate) {
      const sessionResult = await createQuickMatchSession(
        playerId,
        queueEntry.gameType as "SINGLES" | "DOUBLES",
        candidate.playerId,
      );
      if (sessionResult.success) {
        const matchRequest = await prisma.matchRequest.create({
          data: {
            sessionId: sessionResult.data.sessionId,
            requesterId: playerId,
            recipientId: candidate.playerId,
            type: "SYSTEM_AUTO",
            status: "PENDING",
            compositeScore: candidate.score,
            expiresAt: new Date(Date.now() + CONFIRMATION_TIMEOUT_MS),
          },
        });

        // Re-fetch to return CONFIRMING state
        const otherPlayer = await prisma.user.findUniqueOrThrow({
          where: { id: candidate.playerId },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            playerProfile: {
              select: { skillLevel: true, avgSportsmanshipRating: true },
            },
          },
        });

        return {
          state: "CONFIRMING" as const,
          request: {
            id: matchRequest.id,
            type: matchRequest.type,
            compositeScore: candidate.score,
          },
          otherPlayer,
          timeRemainingMs: CONFIRMATION_TIMEOUT_MS,
          myResponse: "PENDING" as const,
          sessionId: sessionResult.data.sessionId,
        };
      }
    }

    // Default: SEARCHING
    return {
      state: "SEARCHING" as const,
      queueEntry: {
        id: queueEntry.id,
        gameType: queueEntry.gameType,
        createdAt: queueEntry.createdAt.toISOString(),
      },
      timeRemainingMs: Math.max(0, queueEntry.windowEnd.getTime() - now),
      nearbyPlayerCount,
    };
  }),

  getSuggestions: playerProcedure.query(async ({ ctx }) => {
    return findCandidates(ctx.user.id);
  }),

  sendRequest: playerProcedure
    .input(sendRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await sendManualRequest(ctx.user.id, input.recipientId);
      if (!result.success) {
        throw new TRPCError({
          code: result.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error,
        });
      }
      return result.data;
    }),

  respondToRequest: playerProcedure
    .input(respondToRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await respondToRequest(
        ctx.user.id,
        input.requestId,
        input.action,
      );
      if (!result.success) {
        const codeMap: Record<
          string,
          "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST"
        > = {
          NOT_FOUND: "NOT_FOUND",
          FORBIDDEN: "FORBIDDEN",
        };
        throw new TRPCError({
          code: codeMap[result.code ?? ""] ?? "BAD_REQUEST",
          message: result.error,
        });
      }
      return result.data;
    }),

  cancelRequest: playerProcedure
    .input(cancelRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await cancelManualRequest(ctx.user.id, input.requestId);
      if (!result.success) {
        const codeMap: Record<
          string,
          "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST"
        > = {
          NOT_FOUND: "NOT_FOUND",
          FORBIDDEN: "FORBIDDEN",
        };
        throw new TRPCError({
          code: codeMap[result.code ?? ""] ?? "BAD_REQUEST",
          message: result.error,
        });
      }
      return null;
    }),

  getQueuePlayers: playerProcedure
    .input(listNearbyVenuesSchema)
    .query(async ({ ctx, input }) => {
      return getQueuePlayerLocations(
        input.latitude,
        input.longitude,
        input.radiusKm,
        ctx.user.id,
      );
    }),
});

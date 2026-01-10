"use client";

import { useState, useEffect, useCallback } from "react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import {
  UserPresence,
  PresenceState,
  toUserPresence,
} from "@/types/presence";

interface UsePresenceTrackingProps {
  provider: TiptapCollabProvider | null;
  currentUserId: string | null;
}

interface UsePresenceTrackingResult {
  presenceState: PresenceState;
  resetPresence: () => void;
}

const INITIAL_PRESENCE_STATE: PresenceState = {
  users: new Map(),
  currentUser: null,
  isLoading: false,
};

/**
 * Manages presence tracking for collaborative editing sessions.
 * Handles awareness change events and maintains user connection states.
 *
 * Key behaviors:
 * - Subscribes to awareness change events from the TipTap provider
 * - Maintains a Map of connected users with their presence data
 * - Marks users as disconnected (rather than removing) when they disappear
 * - Provides resetPresence() for cleanup during logout
 */
export function usePresenceTracking({
  provider,
  currentUserId,
}: UsePresenceTrackingProps): UsePresenceTrackingResult {
  const [presenceState, setPresenceState] =
    useState<PresenceState>(INITIAL_PRESENCE_STATE);

  const resetPresence = useCallback(() => {
    setPresenceState(INITIAL_PRESENCE_STATE);
  }, []);

  useEffect(() => {
    if (!provider || !currentUserId) return;

    const handleAwarenessChange = ({
      states,
    }: {
      states: Array<{ clientId: number; [key: string]: unknown }>;
    }) => {
      const updatedUsers = new Map<string, UserPresence>();
      let currentUserPresence: UserPresence | null = null;

      // Process incoming awareness states
      states.forEach((state) => {
        if (state.presence) {
          const presence = toUserPresence(
            state.presence as Parameters<typeof toUserPresence>[0]
          );
          updatedUsers.set(presence.userId, presence);

          if (presence.userId === currentUserId) {
            currentUserPresence = presence;
          }
        }
      });

      // Merge with previous state, marking missing users as disconnected
      // This ensures smooth UX when users go offline (they appear as disconnected
      // rather than disappearing completely).
      setPresenceState((prev) => {
        const mergedUsers = new Map(prev.users);

        // Mark users who disappeared from awareness as disconnected
        for (const [userId, oldPresence] of prev.users) {
          if (
            !updatedUsers.has(userId) &&
            oldPresence.status === "connected"
          ) {
            mergedUsers.set(userId, {
              ...oldPresence,
              status: "disconnected",
              isConnected: false,
              lastSeen: new Date(),
            });
          }
        }

        // Overlay current awareness data (takes precedence)
        for (const [userId, presence] of updatedUsers) {
          mergedUsers.set(userId, presence);
        }

        return {
          ...prev,
          users: mergedUsers,
          currentUser: currentUserPresence || prev.currentUser,
        };
      });
    };

    provider.on("awarenessChange", handleAwarenessChange);

    return () => {
      provider.off("awarenessChange", handleAwarenessChange);
    };
  }, [provider, currentUserId]);

  return { presenceState, resetPresence };
}

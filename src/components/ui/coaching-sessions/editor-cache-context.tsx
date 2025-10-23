"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import * as Y from "yjs";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import type { Extensions } from "@tiptap/core";
import { Extensions as createExtensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import { useCollaborationToken } from "@/lib/api/collaboration-token";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { siteConfig } from "@/site.config";
import {
  UserPresence,
  PresenceState,
  AwarenessData,
  createConnectedPresence,
  createDisconnectedPresence,
  toUserPresence,
} from "@/types/presence";
import { useCurrentRelationshipRole } from "@/lib/hooks/use-current-relationship-role";
import { logoutCleanupRegistry } from "@/lib/hooks/logout-cleanup-registry";

/**
 * EditorCacheProvider manages TipTap collaboration lifecycle:
 * - Y.Doc creation/reuse across session changes
 * - Provider connection/disconnection with proper cleanup
 * - User presence synchronization via awareness protocol
 * - Graceful fallback to non-collaborative mode on errors
 */

interface EditorCacheState {
  yDoc: Y.Doc | null;
  collaborationProvider: TiptapCollabProvider | null;
  extensions: Extensions;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  presenceState: PresenceState;
}

interface EditorCacheContextType extends EditorCacheState {
  resetCache: () => void;
}

const EditorCacheContext = createContext<EditorCacheContextType | null>(null);

export const useEditorCache = () => {
  const context = useContext(EditorCacheContext);
  if (!context) {
    throw new Error("useEditorCache must be used within EditorCacheProvider");
  }
  return context;
};

interface EditorCacheProviderProps {
  sessionId: string;
  children: ReactNode;
}

export const EditorCacheProvider: React.FC<EditorCacheProviderProps> = ({
  sessionId,
  children,
}) => {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const {
    jwt,
    isLoading: tokenLoading,
    isError: tokenError,
  } = useCollaborationToken(sessionId);

  const { relationship_role: userRole } = useCurrentRelationshipRole();

  // Store provider ref to prevent recreation
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  const [cache, setCache] = useState<EditorCacheState>({
    yDoc: null,
    collaborationProvider: null,
    extensions: [],
    isReady: false,
    isLoading: true,
    error: null,
    presenceState: {
      users: new Map(),
      currentUser: null,
      isLoading: false,
    },
  });

  // Y.Doc lifecycle: create new document when session changes
  const getOrCreateYDoc = useCallback(() => {
    if (!yDocRef.current || lastSessionIdRef.current !== sessionId) {
      yDocRef.current = new Y.Doc();
      lastSessionIdRef.current = sessionId;
    }
    return yDocRef.current;
  }, [sessionId]);

  // Provider initialization: sets up TipTap collaboration with awareness
  const initializeProvider = useCallback(async () => {
    if (!jwt || !siteConfig.env.tiptapAppId || !userSession) {
      return;
    }

    const doc = getOrCreateYDoc();

    try {
      const provider = new TiptapCollabProvider({
        name: jwt.sub,
        appId: siteConfig.env.tiptapAppId,
        token: jwt.token,
        document: doc,
        user: userSession.display_name,
      });

      // Provider event handlers: sync completion enables collaborative editing
      provider.on("synced", () => {
        const collaborativeExtensions = createExtensions(doc, provider, {
          name: userSession.display_name,
          color: "#ffcc00",
        });

        setCache((prev) => ({
          ...prev,
          yDoc: doc,
          collaborationProvider: provider,
          extensions: collaborativeExtensions,
          isReady: true,
          isLoading: false,
          error: null,
        }));
      });

      // Awareness initialization: establishes user presence in collaborative session
      const userPresence = createConnectedPresence({
        userId: userSession.id,
        name: userSession.display_name,
        relationshipRole: userRole,
        color: "#ffcc00",
      });

      provider.setAwarenessField("user", {
        name: userSession.display_name,
        color: "#ffcc00",
      });

      provider.setAwarenessField("presence", userPresence);

      providerRef.current = provider;

      // Awareness synchronization: tracks all connected users for presence indicators
      provider.on(
        "awarenessChange",
        ({ states }: { states: Map<string, { presence?: AwarenessData }> }) => {
          const updatedUsers = new Map<string, UserPresence>();
          let currentUserPresence: UserPresence | null = null;

          states.forEach((state) => {
            if (state.presence) {
              const presence = toUserPresence(state.presence);
              updatedUsers.set(presence.userId, presence);

              if (presence.userId === userSession.id) {
                currentUserPresence = presence;
              }
            }
          });

          setCache((prev) => ({
            ...prev,
            presenceState: {
              ...prev.presenceState,
              users: updatedUsers,
              currentUser:
                currentUserPresence || prev.presenceState.currentUser,
            },
          }));
        }
      );

      // Connection state management: maintains awareness during network changes
      provider.on("connect", () => {
        const connectedPresence = createConnectedPresence({
          userId: userSession.id,
          name: userSession.display_name,
          relationshipRole: userRole,
          color: "#ffcc00",
        });
        provider.setAwarenessField("presence", connectedPresence);
        provider.setAwarenessField("user", {
          name: userSession.display_name,
          color: "#ffcc00",
        });
      });

      provider.on("disconnect", () => {
        const disconnectedPresence = createDisconnectedPresence(userPresence);
        provider.setAwarenessField("presence", disconnectedPresence);
      });

      // Mouse tracking: enables collaborative cursor positioning
      const handleMouseMove = (event: MouseEvent) => {
        if (providerRef.current) {
          providerRef.current.setAwarenessField("user", {
            name: userSession.display_name,
            color: "#ffcc00",
            mouseX: event.clientX,
            mouseY: event.clientY,
          });
        }
      };

      document.addEventListener("mousemove", handleMouseMove);

      // Graceful disconnect on page unload
      const handleBeforeUnload = () => {
        const disconnectedPresence = createDisconnectedPresence(userPresence);
        provider.setAwarenessField("presence", disconnectedPresence);
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    } catch (error) {
      console.error("Collaboration provider initialization failed:", error);

      // Fallback to offline editing mode
      const fallbackExtensions = createExtensions(null, null);

      setCache((prev) => ({
        ...prev,
        yDoc: doc,
        collaborationProvider: null,
        extensions: fallbackExtensions,
        isReady: true,
        isLoading: false,
        error:
          error instanceof Error
            ? error
            : new Error("Failed to initialize collaboration"),
      }));
    }
  }, [jwt, userSession, userRole, getOrCreateYDoc]);

  // Provider lifecycle: manages connection state across session/token changes
  useEffect(() => {
    setCache((prev) => ({ ...prev, isLoading: tokenLoading }));

    if (tokenLoading) {
      return;
    }

    // Session change cleanup: disconnect stale provider
    if (lastSessionIdRef.current !== sessionId && providerRef.current) {
      providerRef.current.disconnect();
      providerRef.current = null;
    }

    // Provider initialization or fallback to offline mode
    if (jwt && !tokenError && userSession) {
      initializeProvider();
    } else {
      // Fallback to offline mode when token is unavailable
      // Note: Don't set error state for token timeouts - let SWR retry in background
      // The editor should remain visible in read-only mode until connection is available
      const doc = getOrCreateYDoc();
      const fallbackExtensions = createExtensions(null, null);

      setCache((prev) => ({
        ...prev,
        yDoc: doc,
        collaborationProvider: null,
        extensions: fallbackExtensions,
        isReady: true,
        isLoading: false,
        error: null, // Don't treat token timeout as fatal error
      }));
    }

    return () => {
      if (providerRef.current) {
        providerRef.current.disconnect();
      }
    };
  }, [
    sessionId,
    jwt,
    tokenLoading,
    tokenError,
    userSession,
    userRole,
    getOrCreateYDoc,
    initializeProvider,
  ]);

  // Logout cleanup registration: ensures proper provider teardown on session end
  useEffect(() => {
    const cleanup = () => {
      const provider = providerRef.current;

      if (provider) {
        try {
          // Clear user presence to signal departure
          provider.setAwarenessField("presence", null);
          provider.setAwarenessField("user", null);

          // Graceful provider shutdown
          provider.disconnect();
          providerRef.current = null;

          // Async destroy to ensure disconnect completes
          queueMicrotask(() => {
            provider.destroy();
          });
        } catch (error) {
          console.error("Provider cleanup failed during logout:", error);
          providerRef.current = null;
        }
      }

      // Reset cache state for clean logout
      setCache((prev) => ({
        ...prev,
        collaborationProvider: null,
        presenceState: {
          users: new Map(),
          currentUser: null,
          isLoading: false,
        },
      }));
    };

    const unregisterCleanup = logoutCleanupRegistry.register(cleanup);

    return () => {
      unregisterCleanup();
    };
  }, []);

  // Cache reset: clears all state for fresh initialization
  const resetCache = useCallback(() => {
    if (providerRef.current) {
      try {
        providerRef.current.destroy();
      } catch (error) {
        console.warn("Provider cleanup failed during reset:", error);
      }
      providerRef.current = null;
    }

    yDocRef.current = null;
    lastSessionIdRef.current = null;

    setCache({
      yDoc: null,
      collaborationProvider: null,
      extensions: [],
      isReady: false,
      isLoading: true,
      error: null,
      presenceState: {
        users: new Map(),
        currentUser: null,
        isLoading: false,
      },
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Only create a new object when cache state or resetCache function actually changes
  // This is important because React Context will trigger re-renders in all consumers
  // whenever the value object reference changes, even if the contents are identical
  const contextValue: EditorCacheContextType = useMemo(
    () => ({
      ...cache,
      resetCache,
    }),
    [cache, resetCache]
  );

  return (
    <EditorCacheContext.Provider value={contextValue}>
      {children}
    </EditorCacheContext.Provider>
  );
};

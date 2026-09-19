"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from "react";
import * as Y from "yjs";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import type { Editor, Extensions } from "@tiptap/core";
import { Extensions as createExtensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import {
  fetchCollaborationTokenWithRetry,
  useCollaborationToken,
} from "@/lib/api/collaboration-token";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { siteConfig } from "@/site.config";
import type { Jwt } from "@/types/jwt";
import { type Option, Some, None } from "@/types/option";
import type { UserSession } from "@/types/user-session";
import {
  PresenceState,
  UserPresence,
  toUserPresence,
  createConnectedPresence,
  createDisconnectedPresence,
} from "@/types/presence";
import { useCurrentRelationshipRole } from "@/lib/hooks/use-current-relationship-role";
import { useLogoutCleanup } from "@/lib/hooks/use-logout-cleanup";
import { generateCollaborativeUserColor } from "@/lib/tiptap-utils";

/** Timeout before enabling offline editing when TipTap Cloud sync doesn't complete */
const SYNC_TIMEOUT_MS = 10_000;

/**
 * EditorCacheProvider manages TipTap collaboration lifecycle:
 * - Y.Doc creation/reuse across session changes
 * - Provider connection/disconnection with proper cleanup
 * - User presence synchronization via awareness protocol
 * - Graceful fallback to non-collaborative mode on errors
 *
 * @see docs/architecture/editor-cache-mechanism.md for architecture details
 */

// ============================================
// Types
// ============================================

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
  /** The notes editor registers its instance here so non-editor descendants
   * (e.g. the Topics panel) can issue commands without being inside the
   * EditorProvider tree. */
  registerEditor: (editor: Editor | null) => void;
  /** Inserts `text` into the notes at the cursor, inheriting the formatting
   * of the block the cursor is in. Returns false when the editor isn't ready
   * or the text is blank. */
  insertTextIntoNotes: (text: string) => boolean;
}

// Provider lifecycle action types (discriminated union)
const ActionKind = {
  Initialize: "initialize",
  Skip: "skip",
  Error: "error",
  Cleanup: "cleanup",
} as const;

interface InitializeAction {
  readonly kind: typeof ActionKind.Initialize;
}

interface SkipAction {
  readonly kind: typeof ActionKind.Skip;
  readonly reason: string;
}

interface ErrorAction {
  readonly kind: typeof ActionKind.Error;
  readonly error: Error;
}

interface CleanupAction {
  readonly kind: typeof ActionKind.Cleanup;
}

type ProviderAction =
  | InitializeAction
  | SkipAction
  | ErrorAction
  | CleanupAction;

// Provider lifecycle state for determining actions
interface ProviderLifecycleState {
  readonly tokenLoading: boolean;
  readonly tokenError: boolean;
  readonly jwt: Jwt | undefined;
  readonly userSession: UserSession | undefined;
  readonly hasProvider: boolean;
  readonly sessionChanged: boolean;
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

// ============================================
// Helper Functions
// ============================================

/**
 * Creates the initial cache state with default values.
 */
function createInitialCacheState(): EditorCacheState {
  return {
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
  };
}

/**
 * Determines the appropriate action based on provider lifecycle state.
 * Uses discriminated union pattern for exhaustive type checking.
 */
function determineProviderAction(
  state: ProviderLifecycleState,
): ProviderAction {
  // Still loading token - wait
  if (state.tokenLoading) {
    return { kind: ActionKind.Skip, reason: "Token still loading" };
  }

  // Session changed and provider exists - cleanup needed
  if (state.sessionChanged && state.hasProvider) {
    return { kind: ActionKind.Cleanup };
  }

  // Have valid token and session - check if initialization needed
  if (state.jwt && !state.tokenError && state.userSession) {
    if (state.hasProvider && !state.sessionChanged) {
      return {
        kind: ActionKind.Skip,
        reason: "Provider already initialized for this session",
      };
    }
    return { kind: ActionKind.Initialize };
  }

  // Token error occurred
  if (state.tokenError) {
    // Transient error guard: don't disrupt working sessions
    if (state.hasProvider && !state.sessionChanged) {
      return {
        kind: ActionKind.Skip,
        reason: "Ignoring transient token error - provider already connected",
      };
    }
    return {
      kind: ActionKind.Error,
      error: new Error(
        "Unable to load coaching notes. Please check your connection and try again.",
      ),
    };
  }

  return { kind: ActionKind.Skip, reason: "Waiting for required state" };
}

type PresenceParams = Parameters<typeof createConnectedPresence>[0];

/**
 * Updates the user's presence on the collaboration provider.
 * Used to re-broadcast presence when user data (like role) changes.
 */
function updatePresenceOnProvider(
  provider: TiptapCollabProvider,
  presence: PresenceParams,
): void {
  const updatedPresence = createConnectedPresence(presence);
  provider.setAwarenessField("presence", updatedPresence);
}

const TOKEN_FETCH_FAILURE_PREFIX = "Failed to get token";

function authFailureMessage(reason: string): string {
  return reason.startsWith(TOKEN_FETCH_FAILURE_PREFIX)
    ? "Coaching notes could not reach the server. Please try again."
    : "Coaching notes could not be authorized. Please try again.";
}

// HocuspocusProvider.destroy() leaves its websocketProvider (and its
// connection-checker interval) alive, so the socket must be destroyed too.
function teardownProvider(
  provider: TiptapCollabProvider,
  presence: Option<PresenceParams>,
): void {
  const steps: Array<[string, () => void]> = [
    ["presence", () => {
      if (!presence.some) return;
      provider.setAwarenessField(
        "presence",
        createDisconnectedPresence(createConnectedPresence(presence.val)),
      );
    }],
    ["provider", () => provider.destroy()],
    ["websocket", () => provider.configuration.websocketProvider.destroy()],
  ];
  for (const [name, step] of steps) {
    try {
      step();
    } catch (error) {
      console.warn(`Collaboration ${name} teardown failed:`, error);
    }
  }
}

// ============================================
// Component
// ============================================

export const EditorCacheProvider: FC<EditorCacheProviderProps> = ({
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
    refresh: refreshToken,
  } = useCollaborationToken(sessionId);

  const { relationship_role: userRole } = useCurrentRelationshipRole();

  // Store provider ref to prevent recreation
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  // The live notes editor instance, registered by CoachingNotes once mounted.
  const editorRef = useRef<Editor | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Clears any pending sync timeout to prevent stale callbacks */
  const clearSyncTimeout = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  // Generate a consistent color for this user session
  const userColor = useMemo(() => generateCollaborativeUserColor(), []);

  const [cache, setCache] = useState<EditorCacheState>(createInitialCacheState);
  // Bumped by resetCache so the lifecycle effect re-runs without a prop change.
  const [initEpoch, setInitEpoch] = useState(0);

  // Y.Doc lifecycle: create new document when session changes
  const getOrCreateYDoc = useCallback(() => {
    if (!yDocRef.current || lastSessionIdRef.current !== sessionId) {
      yDocRef.current = new Y.Doc();
      lastSessionIdRef.current = sessionId;
    }
    return yDocRef.current;
  }, [sessionId]);

  // Always-current presence data for event handlers inside initializeProvider.
  // Declared before initializeProvider so handlers can close over the ref (stable
  // reference) rather than over the individual values (stale closure).
  const cleanupDataRef = useRef({ userSession, userRole, userColor });
  cleanupDataRef.current = { userSession, userRole, userColor };

  const currentPresence = useCallback((): Option<PresenceParams> => {
    const { userSession, userRole, userColor } = cleanupDataRef.current;
    if (!userSession || !userRole.some) return None;
    return Some({
      userId: userSession.id,
      name: userSession.display_name,
      relationshipRole: userRole.val,
      color: userColor,
    });
  }, []);

  useEffect(() => {
    const broadcastDisconnected = () => {
      const provider = providerRef.current;
      const presence = currentPresence();
      if (!provider || !presence.some) return;
      provider.setAwarenessField(
        "presence",
        createDisconnectedPresence(createConnectedPresence(presence.val)),
      );
    };
    window.addEventListener("beforeunload", broadcastDisconnected);
    return () => window.removeEventListener("beforeunload", broadcastDisconnected);
  }, [currentPresence]);

  // Provider initialization: sets up TipTap collaboration with awareness
  const initializeProvider = useCallback(async () => {
    if (!jwt || !siteConfig.env.docsCollabUrl || !userSession) {
      return;
    }

    const doc = getOrCreateYDoc();

    // Per-connect mint: the SWR jwt may be stale; fall back to the last good token so a backend blip on reconnect does not kill the editor.
    let lastGoodToken: Option<string> = None;
    const mintToken = async (): Promise<string> => {
      const fresh = await fetchCollaborationTokenWithRetry(sessionId);
      if (fresh.isOk()) {
        lastGoodToken = Some(fresh.value.token);
        return fresh.value.token;
      }
      if (lastGoodToken.some) return lastGoodToken.val;
      throw fresh.error;
    };

    try {
      const provider = new TiptapCollabProvider({
        name: jwt.sub,
        baseUrl: siteConfig.env.docsCollabUrl,
        token: mintToken,
        document: doc,
        user: userSession.display_name,
        preserveConnection: false,
      });

      // Skip until the role is known so a wrong default role is never broadcast.
      if (userRole.some) {
        const userPresence = createConnectedPresence({
          userId: userSession.id,
          name: userSession.display_name,
          relationshipRole: userRole.val,
          color: userColor,
        });
        // IMPORTANT: Only set our custom "presence" field
        // Let CollaborationCaret manage the "user" field to avoid conflicts
        provider.setAwarenessField("presence", userPresence);
      }

      // Track whether extensions have been created to prevent duplicate creation
      // (both synced handler and timeout handler call enableEditing)
      let extensionsCreated = false;

      // Creates extensions and enables collaborative editing.
      // Called by either the synced handler or the timeout handler — whichever fires first.
      const enableEditing = () => {
        if (extensionsCreated) {
          return;
        }
        extensionsCreated = true;

        const collaborativeExtensions = createExtensions(doc, provider, {
          name: userSession.display_name,
          color: userColor,
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
      };

      // Sync completion: creates extensions and enables collaborative editing
      provider.on("synced", () => {
        clearSyncTimeout();

        enableEditing();
      });

      // Sync timeout: enable offline editing if sync doesn't complete in time.
      // The provider keeps retrying in the background; if sync eventually succeeds,
      // Y.js CRDT merges any local edits with server content seamlessly.
      syncTimeoutRef.current = setTimeout(() => {
        syncTimeoutRef.current = null;
        console.warn(
          `TipTap sync did not complete within ${SYNC_TIMEOUT_MS}ms — enabling offline editing`,
        );
        enableEditing();
      }, SYNC_TIMEOUT_MS);

      providerRef.current = provider;

      provider.on("authenticationFailed", ({ reason }: { reason: string }) => {
        if (providerRef.current !== provider) return;
        clearSyncTimeout();
        console.warn(`TipTap collaboration authentication failed: ${reason}`);
        teardownProvider(provider, None);
        providerRef.current = null;
        setCache((prev) => ({
          ...prev,
          collaborationProvider: null,
          extensions: [],
          isReady: false,
          isLoading: false,
          error: new Error(authFailureMessage(reason)),
        }));
      });

      // Awareness synchronization: tracks all connected users for presence indicators
      provider.on(
        "awarenessChange",
        ({
          states,
        }: {
          states: Array<{ clientId: number; [key: string]: any }>;
        }) => {
          const updatedUsers = new Map<string, UserPresence>();

          // A stale disconnected client must not override live presence.
          states.forEach((state) => {
            if (!state.presence) return;

            const presence = toUserPresence(state.presence);
            const existing = updatedUsers.get(presence.userId);
            if (existing?.isConnected && !presence.isConnected) return;

            updatedUsers.set(presence.userId, presence);
          });

          const currentUserPresence =
            updatedUsers.get(userSession.id) ?? null;

          // IMPORTANT: Preserve previous users who are no longer in states array
          // as disconnected instead of removing them entirely.
          // This ensures smooth UX when users go offline (they appear as disconnected
          // rather than disappearing completely).
          setCache((prev) => {
            const mergedUsers = new Map(prev.presenceState.users);

            // Mark users who disappeared from awareness as disconnected
            // When users "disappear," it means they're no longer in the awareness states array -
            // typically due to network disconnect, browser crash, or navigation away from the coaching
            // session page. Without this code, disconnected users would instantly vanish from the UI,
            // creating an unwanted UX. This preserves them as status: 'disconnected' instead, enabling
            // smooth UX transitions (like showing grayed-out presence indicators).
            for (const [userId, oldPresence] of prev.presenceState.users) {
              if (
                !updatedUsers.has(userId) &&
                oldPresence.status === "connected"
              ) {
                // User was connected but no longer in awareness states - mark as disconnected
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
              presenceState: {
                ...prev.presenceState,
                users: mergedUsers,
                currentUser:
                  currentUserPresence || prev.presenceState.currentUser,
              },
            };
          });
        },
      );

      // Connection state management: maintains awareness during network changes.
      // Reads from cleanupDataRef.current (not the closure) so reconnects always
      // broadcast the current role, not the role captured at initialization time.
      provider.on("connect", () => {
        const {
          userSession: us,
          userRole: ur,
          userColor: uc,
        } = cleanupDataRef.current;
        if (!us || !ur.some) return;
        const connectedPresence = createConnectedPresence({
          userId: us.id,
          name: us.display_name,
          relationshipRole: ur.val,
          color: uc,
        });
        // Only update our custom "presence" field on reconnect
        // CollaborationCaret will handle the "user" field
        provider.setAwarenessField("presence", connectedPresence);
      });

      provider.on("disconnect", () => {
        // NOTE: Don't call setAwarenessField here - we're already disconnected
        // so the message won't be delivered to other clients anyway.
        // The awareness protocol will automatically remove our state via timeout.
        // This event is just for local cleanup/logging if needed.
      });

    } catch (error) {
      console.error("Collaboration provider initialization failed:", error);

      clearSyncTimeout();

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
  }, [
    jwt,
    sessionId,
    userSession,
    userRole,
    userColor,
    getOrCreateYDoc,
    clearSyncTimeout,
  ]);

  // Provider lifecycle: manages connection state across session/token changes
  useEffect(() => {
    setCache((prev) => {
      if (prev.isLoading === tokenLoading) return prev;
      return { ...prev, isLoading: tokenLoading };
    });

    const lifecycleState: ProviderLifecycleState = {
      tokenLoading,
      tokenError,
      jwt,
      userSession,
      hasProvider: providerRef.current !== null,
      sessionChanged: lastSessionIdRef.current !== sessionId,
    };

    const action = determineProviderAction(lifecycleState);

    switch (action.kind) {
      case ActionKind.Skip:
        if (action.reason.includes("transient")) {
          console.debug(action.reason);
        }
        break;

      case ActionKind.Cleanup:
        clearSyncTimeout();
        if (providerRef.current) {
          teardownProvider(providerRef.current, currentPresence());
        }
        providerRef.current = null;
        // After cleanup, immediately initialize for new session if ready.
        // We inline this check rather than re-calling determineProviderAction()
        // because refs don't trigger re-renders and lifecycleState still has
        // hasProvider: true (computed before we modified the ref).
        if (jwt && !tokenError && userSession) {
          initializeProvider();
        }
        break;

      case ActionKind.Initialize:
        // Additional guard: verify provider hasn't been set by concurrent effect
        if (!providerRef.current) {
          initializeProvider();
        }
        break;

      case ActionKind.Error:
        console.warn(
          "Collaboration token fetch failed. This may be due to a network timeout or server issue.",
        );
        setCache((prev) => ({
          ...prev,
          yDoc: null,
          collaborationProvider: null,
          extensions: [],
          isReady: false,
          isLoading: false,
          error: action.error,
        }));
        break;

      default:
        const _exhaustive: never = action;
        throw new Error(`Unhandled action kind: ${_exhaustive}`);
    }

    return () => {
      // IMPORTANT: Only disconnect on unmount or session change
      // Don't disconnect if dependencies change but provider should stay
      if (providerRef.current && lastSessionIdRef.current !== sessionId) {
        clearSyncTimeout();
        teardownProvider(providerRef.current, currentPresence());
        providerRef.current = null;
      }
    };
  }, [
    sessionId,
    initEpoch,
    jwt,
    tokenLoading,
    tokenError,
    userSession,
    userRole,
    getOrCreateYDoc,
    initializeProvider,
    clearSyncTimeout,
    currentPresence,
  ]);

  // Broadcast presence once both the role is definitively known and the editor is ready.
  // userRole is Option<RelationshipRole>: it's None until the coaching relationship loads,
  // then transitions to Some(Coach|Coachee) exactly once. React re-runs this effect when
  // that transition happens AND when cache.isReady becomes true — covering both orderings
  // of those two async events without any manual ref tracking.
  useEffect(() => {
    const provider = providerRef.current;
    if (provider && userSession && cache.isReady && userRole.some) {
      updatePresenceOnProvider(provider, {
        userId: userSession.id,
        name: userSession.display_name,
        relationshipRole: userRole.val,
        color: userColor,
      });
    }
  }, [userRole, userSession, userColor, cache.isReady]);

  // Unmount cleanup: broadcast disconnected presence when leaving the session
  useEffect(() => {
    return () => {
      clearSyncTimeout();
      const provider = providerRef.current;
      if (provider) {
        teardownProvider(provider, currentPresence());
        providerRef.current = null;
      }
    };
  }, [clearSyncTimeout, currentPresence]);

  // Logout cleanup registration: ensures proper provider teardown on session end
  useLogoutCleanup(
    useCallback(() => {
      clearSyncTimeout();

      const provider = providerRef.current;

      if (provider) {
        teardownProvider(provider, currentPresence());
        providerRef.current = null;
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
    }, [clearSyncTimeout, currentPresence]),
  );

  const registerEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const insertTextIntoNotes = useCallback((text: string): boolean => {
    const editor = editorRef.current;
    const trimmed = text.trim();
    if (!editor || editor.isDestroyed || !trimmed) return false;
    // Plain text insert: inherits the formatting of the block at the cursor
    // rather than forcing a node type.
    editor.chain().focus().insertContent(trimmed).run();
    return true;
  }, []);

  // Cache reset: clears all state for fresh initialization
  const resetCache = useCallback(() => {
    clearSyncTimeout();

    if (providerRef.current) {
      teardownProvider(providerRef.current, None);
      providerRef.current = null;
    }

    yDocRef.current = null;
    lastSessionIdRef.current = null;

    setCache(createInitialCacheState());
    void refreshToken();
    setInitEpoch((n) => n + 1);
  }, [clearSyncTimeout, refreshToken]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Only create a new object when cache state or resetCache function actually changes
  // This is important because React Context will trigger re-renders in all consumers
  // whenever the value object reference changes, even if the contents are identical
  const contextValue: EditorCacheContextType = useMemo(
    () => ({
      ...cache,
      resetCache,
      registerEditor,
      insertTextIntoNotes,
    }),
    [cache, resetCache, registerEditor, insertTextIntoNotes],
  );

  return (
    <EditorCacheContext.Provider value={contextValue}>
      {children}
    </EditorCacheContext.Provider>
  );
};

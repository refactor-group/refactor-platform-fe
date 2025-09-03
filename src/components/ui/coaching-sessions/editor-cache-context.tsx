"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import * as Y from 'yjs';
import { TiptapCollabProvider } from '@hocuspocus/provider';
import type { Extensions } from '@tiptap/core';
import { Extensions as createExtensions } from '@/components/ui/coaching-sessions/coaching-notes/extensions';
import { useCollaborationToken } from '@/lib/api/collaboration-token';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { siteConfig } from '@/site.config';
import {
  UserPresence,
  PresenceState,
  AwarenessData,
  createConnectedPresence,
  createDisconnectedPresence,
  toUserPresence
} from '@/types/presence';
import { useCurrentRelationshipRole } from '@/lib/hooks/use-current-relationship-role';

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
    throw new Error('useEditorCache must be used within EditorCacheProvider');
  }
  return context;
};

interface EditorCacheProviderProps {
  sessionId: string;
  children: ReactNode;
}

export const EditorCacheProvider: React.FC<EditorCacheProviderProps> = ({
  sessionId,
  children
}) => {
  const { userSession, isLoggedIn } = useAuthStore((state) => ({
    userSession: state.userSession,
    isLoggedIn: state.isLoggedIn,
  }));

  const { jwt, isLoading: tokenLoading, isError: tokenError } = useCollaborationToken(sessionId);

  const { relationship_role: userRole } = useCurrentRelationshipRole();

  // Store provider ref to prevent recreation
  const providerRef = useRef<TiptapCollabProvider | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const wasLoggedInRef = useRef(isLoggedIn);

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

  // Initialize or reuse Y.Doc
  const getOrCreateYDoc = useCallback(() => {
    if (!yDocRef.current || lastSessionIdRef.current !== sessionId) {
      // Create new Y.Doc only if we don't have one or session changed
      yDocRef.current = new Y.Doc();
      lastSessionIdRef.current = sessionId;
      console.log('📄 Created new Y.Doc for session:', sessionId);
    }
    return yDocRef.current;
  }, [sessionId]);

  // Initialize collaboration provider
  const initializeProvider = useCallback(async () => {
    if (!jwt || !siteConfig.env.tiptapAppId || !userSession) {
      return;
    }

    const doc = getOrCreateYDoc();

    try {
      // Create provider
      const provider = new TiptapCollabProvider({
        name: jwt.sub,
        appId: siteConfig.env.tiptapAppId,
        token: jwt.token,
        document: doc,
        user: userSession.display_name,
      });

      // Configure provider callbacks
      provider.on('synced', () => {
        console.log('🔄 Editor cache: Collaboration synced');

        // Create extensions with collaboration
        const collaborativeExtensions = createExtensions(doc, provider, {
          name: userSession.display_name,
          color: "#ffcc00",
        });

        setCache(prev => ({
          ...prev,
          yDoc: doc,
          collaborationProvider: provider,
          extensions: collaborativeExtensions,
          isReady: true,
          isLoading: false,
          error: null,
        }));
      });

      provider.on('disconnect', () => {
        console.log('🔌 Editor cache: Collaboration disconnected');
      });

      // Set user awareness with presence data using centralized role logic
      const userPresence = createConnectedPresence({
        userId: userSession.id,
        name: userSession.display_name,
        relationshipRole: userRole,
        color: "#ffcc00"
      });

      provider.setAwarenessField("user", {
        name: userSession.display_name,
        color: "#ffcc00",
      });

      provider.setAwarenessField("presence", userPresence);

      providerRef.current = provider;

      // Listen for awareness changes to track presence
      provider.on('awarenessChange', ({ states }: { states: Map<string, { presence?: AwarenessData }> }) => {
        const updatedUsers = new Map<string, UserPresence>();
        let currentUserPresence: UserPresence | null = null;

        states.forEach((state) => {
          if (state.presence) {
            const presence = toUserPresence(state.presence);
            updatedUsers.set(presence.userId, presence);

            // Extract current user from live awareness data to prevent stale state
            if (presence.userId === userSession.id) {
              currentUserPresence = presence;
            }
          }
        });

        setCache(prev => ({
          ...prev,
          presenceState: {
            ...prev.presenceState,
            users: updatedUsers,
            currentUser: currentUserPresence || prev.presenceState.currentUser
          }
        }));
      });

      // Handle connection events
      provider.on('connect', () => {
        console.log('🔗 Editor cache: Provider connected, updating awareness');
        const connectedPresence = createConnectedPresence({
          userId: userSession.id,
          name: userSession.display_name,
          relationshipRole: userRole,
          color: "#ffcc00"
        });
        // Force awareness update on reconnection to prevent stale state
        provider.setAwarenessField("presence", connectedPresence);
        provider.setAwarenessField("user", {
          name: userSession.display_name,
          color: "#ffcc00",
        });
      });

      provider.on('disconnect', () => {
        console.log('🔌 Editor cache: Provider disconnected, updating awareness');
        // Create disconnected presence from current user data
        const disconnectedPresence = createDisconnectedPresence(userPresence);
        provider.setAwarenessField("presence", disconnectedPresence);
      });

      // Set up mouse tracking
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

      // Cleanup on beforeunload
      const handleBeforeUnload = () => {
        const disconnectedPresence = createDisconnectedPresence(userPresence);
        provider.setAwarenessField("presence", disconnectedPresence);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      // Cleanup function
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } catch (error) {
      console.error('❌ Error initializing collaboration provider:', error);

      // Fallback to non-collaborative extensions
      const fallbackExtensions = createExtensions(null, null);

      setCache(prev => ({
        ...prev,
        yDoc: doc,
        collaborationProvider: null,
        extensions: fallbackExtensions,
        isReady: true,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to initialize collaboration'),
      }));
    }
  }, [jwt, userSession, userRole, getOrCreateYDoc]);

  // Initialize provider when JWT and user session are available
  useEffect(() => {
    if (!tokenLoading && jwt && !tokenError) {
      initializeProvider();
    } else if (!tokenLoading && (!jwt || tokenError)) {
      // Use fallback extensions without collaboration (no JWT or JWT error)
      const doc = getOrCreateYDoc();
      const fallbackExtensions = createExtensions(null, null);

      setCache(prev => ({
        ...prev,
        yDoc: doc,
        collaborationProvider: null,
        extensions: fallbackExtensions,
        isReady: true,
        isLoading: false,
        error: tokenError || null,
      }));
    }
  }, [jwt, tokenLoading, tokenError, initializeProvider, getOrCreateYDoc]);

  // Update loading state
  useEffect(() => {
    setCache(prev => ({
      ...prev,
      isLoading: tokenLoading,
    }));
  }, [tokenLoading]);

  // SIMPLE LOGOUT CLEANUP: Destroy provider when user logs out
  useEffect(() => {
    // Check if user went from logged in to logged out
    if (wasLoggedInRef.current && !isLoggedIn) {
      console.log('🚪 User logged out, cleaning up TipTap collaboration provider');
      
      if (providerRef.current) {
        try {
          providerRef.current.destroy();
        } catch (error) {
          // Don't break logout flow for TipTap cleanup errors
          console.warn('TipTap provider cleanup failed during logout:', error);
        }
        providerRef.current = null;
      }
      
      // Clear provider from cache
      setCache(prev => ({
        ...prev,
        collaborationProvider: null,
        presenceState: {
          users: new Map(),
          currentUser: null,
          isLoading: false,
        },
      }));
    }
    
    // Update ref for next effect run
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // Reset cache function
  const resetCache = useCallback(() => {
    console.log('🔄 Resetting editor cache');

    // Destroy provider (consistent with logout cleanup)
    if (providerRef.current) {
      try {
        providerRef.current.destroy();
      } catch (error) {
        console.warn('TipTap provider cleanup failed during reset:', error);
      }
      providerRef.current = null;
    }

    // Clear refs
    yDocRef.current = null;
    lastSessionIdRef.current = null;
    wasLoggedInRef.current = isLoggedIn; // Reset login state tracking

    // Reset state
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
    // We intentionally omit isLoggedIn from deps to keep resetCache function stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount or session change
  useEffect(() => {
    return () => {
      if (lastSessionIdRef.current !== sessionId && providerRef.current) {
        console.log('🧹 Cleaning up provider on session change');
        providerRef.current.disconnect();
      }
    };
  }, [sessionId]);

  const contextValue: EditorCacheContextType = {
    ...cache,
    resetCache,
  };

  return (
    <EditorCacheContext.Provider value={contextValue}>
      {children}
    </EditorCacheContext.Provider>
  );
};
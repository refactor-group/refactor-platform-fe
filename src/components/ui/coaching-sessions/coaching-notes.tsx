"use client";

import { EditorProvider, useEditor, EditorContent } from "@tiptap/react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useCollaborationToken } from "@/lib/api/collaboration-token";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { Extensions as createExtensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import { Progress } from "@/components/ui/progress";
import { SimpleToolbar } from "@/components/ui/coaching-sessions/coaching-notes/simple-toolbar";
import { FloatingToolbar } from "@/components/ui/coaching-sessions/coaching-notes/floating-toolbar";
import { siteConfig } from "@/site.config";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/core";
import { validateExtensions } from "@/types/tiptap";
import "@/styles/simple-editor.scss";

const tiptapAppId = siteConfig.env.tiptapAppId;

const useCollaborationProvider = (doc: Y.Doc) => {
  // Get coaching session ID from URL
  const { currentCoachingSessionId } = useCurrentCoachingSession();
  
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const { jwt, isLoading, isError } = useCollaborationToken(
    currentCoachingSessionId || ""
  );
  const [isSyncing, setIsSyncing] = useState(true);
  const [extensions, setExtensions] = useState<Extensions>([]);
  const [collaborationReady, setCollaborationReady] = useState(false);
  const providerRef = useRef<TiptapCollabProvider>(null);

  useEffect(() => {
    if (!tiptapAppId) {
      console.error("TIPTAP_APP_ID not set");
      return;
    }

    if (jwt) {
      if (!providerRef.current) {
        // if we haven't initialize a provider yet,
        // initialize one and update the providerRef that will persist
        // during re-renders so we don't initialize more providers
        providerRef.current = new TiptapCollabProvider({
          name: jwt.sub,
          appId: tiptapAppId,
          token: jwt.token,
          document: doc,
          user: userSession.display_name,
          connect: true,
          broadcast: true,
          onSynced: () => {
            console.log('🔄 TipTap Cloud collaboration synced');
            setIsSyncing(false);
            setCollaborationReady(true);
            // Set extensions immediately when synced
            if (doc && providerRef.current) {
              console.log('🔧 Setting collaborative extensions');
              setExtensions(createExtensions(doc, providerRef.current, {
                name: userSession.display_name,
                color: "#ffcc00",
              }));
            }
          },
        });

        providerRef.current.setAwarenessField("user", {
          name: userSession.display_name,
          color: "#ffcc00",
        });

        document.addEventListener("mousemove", (event) => {
          if (providerRef.current) {
            providerRef.current.setAwarenessField("user", {
              name: userSession.display_name,
              color: "#ffcc00",
              mouseX: event.clientX,
              mouseY: event.clientY,
            });
          }
        });
      } else {
        // otherwise, reconnect the existing provider
        providerRef.current.connect();
      }
    }

    return () => {
      if (providerRef.current) {
        providerRef.current.disconnect();
      }
    };
  }, [jwt, doc, userSession.display_name]);

  return {
    // isSyncing indicates whether a first handshake with the server has been established
    // which is exactly the right thing to indicate if this hook isLoading or not.
    isLoading: isSyncing,
    isError,
    extensions,
    collaborationReady,
  };
};

const CoachingNotes = () => {
  const [doc] = useState(() => {
    const newDoc = new Y.Doc();
    console.log('📄 Created Y.js document:', newDoc);
    return newDoc;
  });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { isLoading, isError, extensions, collaborationReady } = useCollaborationProvider(doc);
  
  // Fallback extensions for when collaboration fails - create a minimal safe version
  const fallbackExtensions = useMemo(() => {
    try {
      // Explicitly pass null to ensure no collaboration extensions
      console.log('🔧 Creating fallback extensions with no collaboration');
      return createExtensions(null, null);
    } catch (error) {
      console.error('❌ Error creating fallback extensions:', error);
      // Return absolute minimal extensions if even fallback fails
      console.log('🔧 Falling back to minimal StarterKit only');
      return [StarterKit];
    }
  }, []);

  // Select appropriate extensions based on collaboration state
  const activeExtensions = useMemo((): Extensions => {
    try {
      // Use collaborative extensions if they're ready and valid
      if (collaborationReady && extensions.length > 0 && !isLoading) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 Using collaborative extensions:', extensions.length);
        }
        // TipTap's Extensions type already ensures proper validation
        return validateExtensions(extensions);
      }
      
      // Fallback to non-collaborative extensions
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Using fallback extensions:', fallbackExtensions.length);
      }
      return validateExtensions(fallbackExtensions);
    } catch (error) {
      console.error('❌ Error selecting extensions:', error);
      // Return minimal safe extensions on error
      return fallbackExtensions.length > 0 ? fallbackExtensions : [StarterKit];
    }
  }, [collaborationReady, extensions, fallbackExtensions, isLoading]);

  // Simulate loading progress
  useEffect(() => {
    if (isLoading) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90; // Stop at 90% until actually loaded
          }
          return prev + Math.random() * 15;
        });
      }, 150);

      return () => clearInterval(interval);
    } else {
      // Complete the progress (100%) when loading is done
      setLoadingProgress(100);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-loading">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Loading coaching notes...
              </span>
              <span className="text-sm opacity-70">
                {Math.round(loadingProgress)}%
              </span>
            </div>
            <Progress value={loadingProgress} className="h-2" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-error">
          <div className="text-center">
            <p className="mb-2">⚠️ Could not load coaching notes</p>
            <p className="text-sm opacity-80">Please try again later or contact support if the issue persists.</p>
          </div>
        </div>
      </div>
    );
  }

  // Add safety check for extensions
  if (!activeExtensions || activeExtensions.length === 0) {
    console.warn('⚠️ No valid extensions available, showing minimal editor');
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-error">
          <div className="text-center">
            <p className="mb-2">⚠️ Editor is loading...</p>
            <p className="text-sm opacity-80">Please wait while extensions are initialized.</p>
          </div>
        </div>
      </div>
    );
  }

  try {
    console.log('🚀 About to initialize EditorProvider with extensions:', activeExtensions.length);
    console.log('🔍 Extension details:', activeExtensions.map(ext => ext?.name || 'unknown'));
    
    return <CoachingNotesWithFloatingToolbar extensions={activeExtensions} />;
  } catch (error) {
    console.error('❌ Error initializing EditorProvider:', error);
    console.error('❌ Active extensions:', activeExtensions);
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-error">
          <div className="text-center">
            <p className="mb-2">❌ Failed to initialize editor</p>
            <p className="text-sm opacity-80">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }
};

// Wrapper component with floating toolbar functionality
const CoachingNotesWithFloatingToolbar: React.FC<{ extensions: Extensions }> = ({ extensions }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [originalToolbarVisible, setOriginalToolbarVisible] = useState(true);

  const handleOriginalToolbarVisibilityChange = useCallback((visible: boolean) => {
    setOriginalToolbarVisible(visible);
  }, []);

  return (
    <div ref={editorRef} className="coaching-notes-editor">
      <EditorProvider
        extensions={extensions}
        autofocus={false}
        immediatelyRender={false}
        shouldRerenderOnTransaction={false}
        onContentError={(error) =>
          console.error("Editor content error:", error)
        }
        editorProps={{
          attributes: {
            class: "tiptap ProseMirror",
            spellcheck: "true",
          },
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;
              // Check if the clicked element is an <a> tag and Shift is pressed
              if (
                (target.tagName === "A" || target.parentElement?.tagName === "A") &&
                event.shiftKey
              ) {
                event.preventDefault(); // Prevent default link behavior
                const href = target.getAttribute("href") || target.parentElement?.getAttribute("href");
                if (href) {
                  window.open(href, "_blank")?.focus();
                }
                return true; // Stop event propagation
              }
              return false; // Allow other handlers to process the event
            },
          },
        }}
        slotBefore={
          <div 
            ref={toolbarRef}
            style={{ visibility: originalToolbarVisible ? 'visible' : 'hidden' }}
          >
            <SimpleToolbar />
          </div>
        }
        slotAfter={
          <FloatingToolbar 
            editorRef={editorRef} 
            toolbarRef={toolbarRef} 
            headerHeight={64} // Can be made configurable via props or site config
            onOriginalToolbarVisibilityChange={handleOriginalToolbarVisibilityChange}
          />
        }
      />
    </div>
  );
};

export { CoachingNotes };

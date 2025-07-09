"use client";

import { EditorProvider } from "@tiptap/react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useRef, useState } from "react";
import { useCollaborationToken } from "@/lib/api/collaboration-token";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import { Progress } from "@/components/ui/progress";
import { Toolbar } from "@/components/ui/coaching-sessions/coaching-notes/toolbar";
import { siteConfig } from "@/site.config";
import "@/styles/styles.scss";

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
  const [extensions, setExtensions] = useState<Array<any>>([]);
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
            setIsSyncing(false);
            // Setting these here with the goal of only initializing things once
            setExtensions(Extensions(doc, providerRef.current));
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
  };
};

const CoachingNotes = () => {
  const [doc] = useState(() => new Y.Doc());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { isLoading, isError, extensions } = useCollaborationProvider(doc);

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
      <div className="flex flex-col items-center justify-center space-y-4 p-8 min-h-[440px] lg:min-h-[440px] sm:min-h-[200px] md:min-h-[350px]">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Loading coaching notes...
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(loadingProgress)}%
            </span>
          </div>
          <Progress value={loadingProgress} className="h-2" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        We could not retrieve your coaching notes. Please try again later.
      </div>
    );
  }

  return (
    <div className="border rounded">
      <EditorProvider
        extensions={extensions}
        autofocus={false}
        immediatelyRender={false}
        onContentError={(error) =>
          console.error("Editor content error:", error)
        }
        editorProps={{
          attributes: {
            class:
              "tiptap ProseMirror shadow appearance-none lg:min-h-[440px] sm:min-h-[200px] md:min-h-[350px] rounded w-full py-2 px-3 bg-inherit text-black dark:text-white text-sm mt-0 md:mt-3 leading-tight focus:outline-none focus:shadow-outline",
          },
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;
              // Check if the clicked element is an <a> tag and Shift is pressed
              if (
                (target.tagName === "A" || target.parentElement?.tagName) &&
                event.shiftKey
              ) {
                event.preventDefault(); // Prevent default link behavior
                window
                  .open(target.getAttribute("href") || "", "_blank")
                  ?.focus();
                return true; // Stop event propagation
              }
              return false; // Allow other handlers to process the event
            },
          },
        }}
        slotBefore={<Toolbar />}
      />
    </div>
  );
};

export { CoachingNotes };

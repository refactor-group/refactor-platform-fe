"use client";

import { EditorProvider } from "@tiptap/react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useRef, useState } from "react";
import { useCollaborationToken } from "@/lib/api/collaboration-token";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import { Toolbar } from "@/components/ui/coaching-sessions/coaching-notes/toolbar";
import { siteConfig } from "@/site.config";
import "@/styles/styles.scss";

const tiptapAppId = siteConfig.env.tiptapAppId;

const useCollaborationProvider = (doc: Y.Doc) => {
  const { currentCoachingSessionId } = useCoachingSessionStateStore(
    (state) => state
  );
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const { jwt, isLoading, isError } = useCollaborationToken(
    currentCoachingSessionId
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
  }, [jwt, providerRef.current]);

  return {
    isLoading: isLoading || isSyncing,
    userSession,
    isError,
    extensions,
  };
};

const CoachingNotes = () => {
  const [doc] = useState(() => new Y.Doc());
  const { isLoading, isError, extensions } = useCollaborationProvider(doc);

  if (isLoading) return <div>Loading coaching notes...</div>;
  if (isError)
    return (
      <div>
        We could not retrieve your coaching notes. Please try again later.
      </div>
    );

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
        }}
        slotBefore={<Toolbar />}
      />
    </div>
  );
};

export { CoachingNotes };

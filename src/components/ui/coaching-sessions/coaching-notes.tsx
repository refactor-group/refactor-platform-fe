"use client";

import { EditorProvider } from "@tiptap/react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useState } from "react";
import { useCollaborationToken } from "@/lib/api/collaboration-token";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import { Toolbar } from "@/components/ui/coaching-sessions/coaching-notes/toolbar";
import { siteConfig } from "@/site.config";
import "@/styles/styles.scss";

const useCollaborationProvider = (doc: Y.Doc) => {
  console.log("useCollaborationProvider");
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
  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);
  const [extensions, setExtensions] = useState<Array<any>>([]);
  useEffect(() => {
    const tiptapAppId = siteConfig.env.tiptapAppId;
    if (!tiptapAppId) {
      console.error("TIPTAP_APP_ID not set");
      return;
    }

    console.log("checking for existing provider");

    if (!isLoading && !isError && jwt && !provider) {
      console.log("initializing new provider");
      const newProvider = new TiptapCollabProvider({
        name: jwt.sub,
        appId: tiptapAppId,
        token: jwt.token,
        document: doc,
        user: userSession.display_name,
        connect: true,
        broadcast: true,
        onSynced() {
          if (!doc.getMap("config").get("initialContentLoaded")) {
            doc.getMap("config").set("initialContentLoaded", true);
          }
        },
      });

      console.log("newProvider", newProvider);

      newProvider.on("synced", () => {
        console.log("synced");
        setIsSyncing(false);
        // Setting these here with the goal of only initializing things once
        setProvider(newProvider);
        setExtensions(Extensions(doc, userSession.display_name, newProvider));
      });

      // Set the awareness field for the current user
      newProvider.setAwarenessField("user", {
        name: userSession.display_name,
        color: "#ffcc00",
      });

      // newProvider.on("awarenessChange", ({ states }) => {
      //   console.log(states);
      // });

      document.addEventListener("mousemove", (event) => {
        newProvider.setAwarenessField("user", {
          name: userSession.display_name,
          color: "#ffcc00",
          mouseX: event.clientX,
          mouseY: event.clientY,
        });
      });

      return () => {
        newProvider.disconnect();
      };
    }
  }, [jwt, isLoading, isError, doc, userSession.display_name]);

  return {
    isLoading: isLoading || isSyncing,
    isError,
    extensions,
  };
};

const CoachingNotes = () => {
  const [doc] = useState(() => new Y.Doc());
  const { isLoading, isError, extensions } = useCollaborationProvider(doc);

  if (isLoading) return <div>Loading editor...</div>;
  if (isError)
    return <div>Error initializing editor. Please try again later.</div>;

  return (
    <div className="border rounded">
      <EditorProvider
        extensions={extensions}
        autofocus={false}
        immediatelyRender={false}
        onContentError={(error: any) =>
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

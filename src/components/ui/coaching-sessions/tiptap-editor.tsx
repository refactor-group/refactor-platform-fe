"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useEffect, useState } from "react";
import { useCollaborationToken } from "@/lib/api/collaborationToken";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { Extensions } from "@/components/ui/coaching-sessions/tiptap-editor/extensions";
import { Toolbar } from "@/components/ui/coaching-sessions/tiptap-editor/toolbar";
import { siteConfig } from "@/site.config";
import "@/styles/styles.scss";

const TipTapEditor = () => {
  const { currentCoachingSessionId } = useCoachingSessionStateStore(
    (state) => state
  );
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const { jwt, isLoading, isError } = useCollaborationToken(
    currentCoachingSessionId
  );

  const [provider, setProvider] = useState<TiptapCollabProvider | null>(null);

  // Initialize the Yjs document
  const [doc] = useState(() => new Y.Doc());

  useEffect(() => {
    const tiptapAppId = siteConfig.env.tiptapAppId;
    if (!tiptapAppId) {
      console.error("TIPTAP_APP_ID not set");
      return; // Optionally return early if the app ID is not set
    }

    // Only initialize the provider when JWT is available and there are no errors
    if (!isLoading && !isError && jwt) {
      const newProvider = new TiptapCollabProvider({
        name: jwt.sub,
        appId: tiptapAppId,
        token: jwt.token,
        document: doc,
        user: userSession.display_name,
        connect: true,
        broadcast: true,
      });

      setProvider(newProvider);

      // Cleanup function to disconnect the provider when the component unmounts
      return () => {
        newProvider.disconnect();
      };
    }
  }, [jwt, isLoading, isError, doc, userSession.display_name]);

  const editor = useEditor({
    extensions: Extensions(doc),
    autofocus: false,
    immediatelyRender: false,
    onContentError: (error) => {
      console.error("Editor content error:", error);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap ProseMirror shadow appearance-none lg:min-h-[440px] sm:min-h-[200px] md:min-h-[350px] rounded w-full py-2 px-3 bg-inherit text-black dark:text-white text-sm mt-0 md:mt-3 leading-tight focus:outline-none focus:shadow-outline",
      },
    },
  });

  if (isLoading) {
    return <div>Loading editor...</div>;
  }

  if (isError) {
    return <div>Error initializing editor. Please try again later.</div>;
  }

  if (!editor || !provider) {
    return null;
  }

  return (
    <div className="border rounded">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export { TipTapEditor };

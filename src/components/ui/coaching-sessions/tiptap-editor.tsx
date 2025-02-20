"use client";

import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Collaboration from "@tiptap/extension-collaboration";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Italic from "@tiptap/extension-italic";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  Bold as BoldIcon,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Strikethrough,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import css from "highlight.js/lib/languages/css";
import js from "highlight.js/lib/languages/javascript";
import ts from "highlight.js/lib/languages/typescript";
import html from "highlight.js/lib/languages/xml";
// Load all languages with "all" or common languages with "common"
import { all, createLowlight } from "lowlight";

// eslint-disable-next-line
import CodeBlock from "@/components/ui/coaching-sessions/code-block";

import "@/styles/styles.scss";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useEffect } from "react";
import { useCollaborationToken } from "@/lib/api/collaborationToken";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

const lowlight = createLowlight(all);

lowlight.register("html", html);
lowlight.register("css", css);
lowlight.register("js", js);
lowlight.register("ts", ts);

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

  const doc = new Y.Doc();

  useEffect(() => {
    if (isLoading || isError || !jwt) return;

    const provider = new TiptapCollabProvider({
      name: jwt.sub,
      appId: "w9nvnx1m", // replace with YOUR_APP_ID from Cloud dashboard
      token: jwt.token,
      document: doc,
      user: userSession.display_name,
      // Connects to the server after initialization
      connect: true,
      // Enables document syncing across browser tabs
      broadcast: true,
      // The onSynced callback ensures initial content is set only once using editor.setContent(), preventing repetitive content loading on editor syncs.
      onSynced() {
        if (!doc.getMap("config").get("initialContentLoaded") && editor) {
          doc.getMap("config").set("initialContentLoaded", true);
          editor.commands.setContent("");
        }
      },
    });
  }, [currentCoachingSessionId, jwt, isLoading, isError, userSession]);

  const editor = useEditor(
    {
      extensions: [
        BulletList,
        CodeBlockLowlight.extend({
          addNodeView() {
            return ReactNodeViewRenderer(CodeBlock);
          },
        }).configure({ lowlight }),
        Bold,
        Document,
        Heading,
        Highlight,
        Italic,
        ListItem,
        OrderedList,
        Paragraph,
        Strike,
        Text,
        Underline,
        Collaboration.configure({
          document: doc,
        }),
      ],

      autofocus: false,
      immediatelyRender: false,

      editorProps: {
        attributes: {
          class:
            "tiptap ProseMirror shadow appearance-none lg:min-h-[440px] sm:min-h-[200px] md:min-h-[350px] rounded w-full py-2 px-3 bg-inherit text-black dark:text-white text-sm mt-0 md:mt-3 leading-tight focus:outline-none focus:shadow-outline",
        },
      },

      // content: editorContent,
      onUpdate: ({ editor }) => {
        // This prints out the JSON representation of the current content when you press a key
        console.log(JSON.stringify(editor.getJSON()));
      },
    },
    []
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded">
      {/* Toolbar style */}
      <div className="flex items-center gap-0 mt-1 mx-1 mb-0">
        {/* Bold Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("bold") ? "button-active" : ""
          }`}
          title="Bold (Ctrl+B)"
        >
          <BoldIcon className="h-4 w-4" />
        </Button>

        {/* Italic Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("italic") ? "button-active" : ""
          }`}
          title="Italic (Ctrl+I)"
        >
          <ItalicIcon className="h-4 w-4" />
        </Button>

        {/* Underline Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("underline") ? "button-active" : ""
          }`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        {/* Strikethrough Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("strike") ? "button-active" : ""
          }
          `}
          title="Strike Through"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        {/* Highlight Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("highlight") ? "button-active" : ""
          }`}
          title="Highlight Text"
        >
          <Highlighter className="h-4 w-4" />
        </Button>

        {/* Heading 1 */}
        <Button
          variant="ghost"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("heading", { level: 1 }) ? "button-active" : ""
          }`}
          title="Heading1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>

        {/* Heading */}
        <Button
          variant="ghost"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("heading", { level: 2 }) ? "button-active" : ""
          }`}
          title="Heading2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        {/* Heading 3 */}
        <Button
          variant="ghost"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("heading", { level: 3 }) ? "button-active" : ""
          }`}
          title="Heading3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        {/* Bullet List Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("bulletList") ? "button-active" : ""
          }`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>

        {/* Ordered List Button */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("orderedList") ? "button-active" : ""
          }`}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 mr-0.5 rounded ${
            editor.isActive("codeBlock") ? "button-active" : ""
          }`}
        >
          <Braces className="h-4 w-4" />
        </Button>
      </div>
      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
};

export { TipTapEditor };

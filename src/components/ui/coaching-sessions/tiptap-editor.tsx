"use client";

import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";

import { TiptapCollabProvider } from "@hocuspocus/provider";

import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
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
import { forwardRef, useEffect, useImperativeHandle } from "react";

import { EditorRef } from "./coaching-notes";

import css from "highlight.js/lib/languages/css";
import js from "highlight.js/lib/languages/javascript";
import ts from "highlight.js/lib/languages/typescript";
import html from "highlight.js/lib/languages/xml";
// Load all languages with "all" or common languages with "common"
import { all, createLowlight } from "lowlight";

// eslint-disable-next-line
import CodeBlock from "@/components/ui/coaching-sessions/code-block";

import "@/styles/styles.scss";

const lowlight = createLowlight(all);

lowlight.register("html", html);
lowlight.register("css", css);
lowlight.register("js", js);
lowlight.register("ts", ts);

const doc = new Y.Doc();
// const collabCursorProvider = new WebrtcProvider(
//   "tiptap-collaboration-cursor-extension",
//   doc
// );

interface TipTapProps {
  editorContent: string;
  onChange: (content: string) => void;
  onSynced?: () => void;
}

const TipTapEditor = forwardRef<EditorRef, TipTapProps>(
  ({ editorContent, onChange, onSynced }, ref) => {
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
            document: doc, // Configure Y.Doc for collaboration
          }),
          // CollaborationCursor.configure({
          //   provider: collabCursorProvider,
          //   user: {
          //     name: "Jim Hodapp",
          //     color: "#ffcc00",
          //   },
          // }),
        ],

        autofocus: false,
        immediatelyRender: false,

        editorProps: {
          attributes: {
            class:
              "tiptap ProseMirror shadow appearance-none lg:min-h-[440px] sm:min-h-[200px] md:min-h-[350px] rounded w-full py-2 px-3 bg-inherit text-black dark:text-white text-sm mt-0 md:mt-3 leading-tight focus:outline-none focus:shadow-outline",
          },
        },

        content: editorContent,
        onUpdate: ({ editor }) => {
          onChange(JSON.stringify(editor.getJSON()));
        },
      },
      []
    );

    // editor?.commands.updateUser({
    //   name: "John Doe",
    //   color: "#000000",
    //   avatar: "https://unavatar.io/github/ueberdosis",
    // });

    useImperativeHandle(ref, () => ({
      setContent: (content: string) => {
        editor?.commands.setContent(JSON.parse(content));
      },

      setFocussed: () => {
        editor?.chain().focus().run();
      },
    }));

    // Connect to your Collaboration server
    useEffect(() => {
      const provider = new TiptapCollabProvider({
        name: "refactor.test.document.name", // Unique document identifier for syncing. This is your document name.
        //appId: "", // Your Cloud Dashboard AppID or ...
        baseUrl: "ws://127.0.0.1:8080", // ... `baseURL` for on-premises
        token: "", // Your JWT token
        document: doc,
        onOpen() {
          console.log("WebSocket connection opened.");
        },
        onConnect() {
          console.log("Connected to the server.");
        },
      });

      provider.on("synced", () => {
        console.debug("provider.on('synced')");
        if (onSynced) {
          onSynced();
        }
      });
    }, []);

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
  }
);

TipTapEditor.displayName = "TipTapEditor";

export { TipTapEditor };

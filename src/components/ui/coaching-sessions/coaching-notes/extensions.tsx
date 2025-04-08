import Document from "@tiptap/extension-document";
import BulletList from "@tiptap/extension-bullet-list";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Bold from "@tiptap/extension-bold";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Italic from "@tiptap/extension-italic";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Collaboration from "@tiptap/extension-collaboration";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CodeBlock from "@/components/ui/coaching-sessions/code-block";
import { createLowlight } from "lowlight";
import { all } from "lowlight";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import { ConfiguredLink } from "./extended-link-extension";
// Initialize lowlight with all languages
const lowlight = createLowlight(all);

export const Extensions = (
  doc: any,
  provider?: TiptapCollabProvider | null
) => {
  return [
    Document,
    BulletList,
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlock);
      },
    }).configure({ lowlight }),
    Bold,
    Heading,
    Highlight,
    Italic,
    ListItem,
    OrderedList,
    Paragraph,
    Strike,
    Text,
    Underline,
    ConfiguredLink,
    Collaboration.configure({
      document: doc,
    }),
    CollaborationCursor.configure({
      provider,
    }),
  ];
};

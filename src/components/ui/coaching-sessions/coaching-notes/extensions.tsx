// TipTap v3 Extensions - Using individual extensions instead of StarterKit to avoid History
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Underline from "@tiptap/extension-underline";
import Code from "@tiptap/extension-code";
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import HardBreak from "@tiptap/extension-hard-break";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
// NOTE: Explicitly NOT importing History - Collaboration provides its own
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { Extensions as TiptapExtensions } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import CodeBlock from "@/components/ui/coaching-sessions/code-block";
import { createLowlight } from "lowlight";
import { all } from "lowlight";
import { TiptapCollabProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { ConfiguredLink, LinkKeyboardShortcut, LinkZombieCleanup } from "./extended-link-extension";
import { Markdown } from "@tiptap/markdown";
import { generateCollaborativeUserColor } from "@/lib/tiptap-utils";
import {
  TableWithMarkdown,
  TableMarkdownPasteHandler,
  TableRow,
  TableCell,
  TableHeader,
} from "./markdown-table-extension";

const lowlight = createLowlight(all);
const INDENT_SIZE = 4; // Number of spaces for indentation

// Tab handler: enables proper indentation in code blocks
const CodeBlockTabHandler = Extension.create({
  name: "codeBlockTabHandler",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Only handle Tab if we're in a code block
        if (this.editor.isActive("codeBlock")) {
          return this.editor.commands.insertContent("    "); // 4 spaces
        }
        // Let other extensions handle Tab if not in code block
        return false;
      },
    };
  },
});

// Collaboration validation: ensures both Y.Doc and provider are available
function hasValidCollaboration(
  doc: Y.Doc | null,
  provider: TiptapCollabProvider | null | undefined
): boolean {
  return !!(provider && doc);
}

// Extensions factory: creates TipTap extensions with optional collaboration

export const Extensions = (
  doc: Y.Doc | null,
  provider?: TiptapCollabProvider | null,
  user?: { name: string; color: string }
): TiptapExtensions => {
  try {
    const baseExtensions = createFoundationExtensions();
    const collaborativeExtensions = buildCollaborationIfValid(
      doc,
      provider,
      user
    );
    const finalExtensions = combineExtensions(
      baseExtensions,
      collaborativeExtensions
    );
    return validateAndReturn(finalExtensions);
  } catch (error) {
    console.error("Extensions creation failed:", error);
    return createMinimalExtensions();
  }
};

// Extension composition logic

const createMinimalExtensions = (): TiptapExtensions => {
  // Minimal fallback extensions for error cases
  return [Document, Paragraph, Text];
};

const createFoundationExtensions = (): TiptapExtensions => {
  return [
    configureBaseExtensions(),
    configureTableRelatedExtensions(),
    addFormattingExtensions(),
    addTaskListExtensions(),
    addCodeBlockWithSyntaxHighlighting(),
    addPlaceholderConfiguration(),
    addLinksConfiguration(),
    addCustomTabHandler(),
  ].flat();
};

const buildCollaborationIfValid = (
  doc: Y.Doc | null,
  provider?: TiptapCollabProvider | null,
  user?: { name: string; color: string }
): TiptapExtensions => {
  if (!hasValidCollaboration(doc, provider)) {
    return [];
  }

  try {
    validateYjsDocument(doc!);
    return [
      createCollaborationExtension(doc!),
      createCollaborationCaret(provider!, user),
    ];
  } catch (error) {
    console.error("Collaborative extensions failed:", error);
    console.warn("Falling back to offline editing mode");
    return [];
  }
};

const combineExtensions = (
  baseExtensions: TiptapExtensions,
  collaborativeExtensions: TiptapExtensions
): TiptapExtensions => {
  return [...baseExtensions, ...collaborativeExtensions];
};

const validateAndReturn = (extensions: TiptapExtensions): TiptapExtensions => {
  if (extensions.length === 0) {
    console.warn("No extensions configured, using minimal extensions");
    return createMinimalExtensions();
  }
  return extensions;
};

// Extension configuration

const configureBaseExtensions = () => {
  // Return individual StarterKit extensions, excluding CodeBlock, Link, and History
  // CodeBlock is replaced with custom CodeBlockLowlight
  // Link is replaced with ConfiguredLink
  // History is excluded because Collaboration provides its own
  // Underline is added separately (not part of StarterKit)
  return [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    Strike,
    Underline,
    Code,
    Heading,
    BulletList,
    OrderedList,
    ListItem,
    Blockquote,
    HorizontalRule,
    HardBreak,
    Dropcursor,
    Gapcursor,
  ];
};

const configureTableRelatedExtensions = () => {
  return [
    TableWithMarkdown,
    TableMarkdownPasteHandler,
    TableRow,
    TableCell,
    TableHeader,
  ];
};

const addFormattingExtensions = (): TiptapExtensions => {
  return [
    Highlight,
    TextStyle,
    Markdown.configure({
      indentation: { style: "space", size: INDENT_SIZE },
    }),
  ];
};

const addTaskListExtensions = (): TiptapExtensions => {
  return [TaskList, TaskItem.configure({ nested: true })];
};

const addCodeBlockWithSyntaxHighlighting = () => {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlock);
    },
  }).configure({
    lowlight,
    defaultLanguage: "plaintext",
  });
};

const addPlaceholderConfiguration = () => {
  return Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return `Heading ${node.attrs.level}...`;
      }
      return "Start typing your coaching notes...";
    },
  });
};

const addLinksConfiguration = () => {
  return [ConfiguredLink, LinkKeyboardShortcut, LinkZombieCleanup];
};

const addCustomTabHandler = () => {
  return CodeBlockTabHandler;
};

const validateYjsDocument = (doc: Y.Doc) => {
  if (!doc?.clientID && doc?.clientID !== 0) {
    console.warn("Document initialization incomplete");
  }
};

const createCollaborationExtension = (doc: Y.Doc) => {
  return Collaboration.configure({
    document: doc,
    yUndoOptions: {
      trackedOrigins: [null],
    },
  });
};

const createCollaborationCaret = (
  provider: TiptapCollabProvider,
  user?: { name: string; color: string }
) => {
  return CollaborationCaret.configure({
    provider: provider,
    user: user || {
      name: "Anonymous",
      color: generateCollaborativeUserColor(),
    },
    render: (user) => {
      const container = document.createElement("span");
      container.classList.add("collaboration-cursor__container");
      container.style.position = "relative";
      container.style.display = "inline-block";

      const cursor = document.createElement("span");
      cursor.classList.add("collaboration-cursor__caret");
      cursor.setAttribute(
        "style",
        `border-color: ${user.color}; --collaboration-user-color: ${user.color};`
      );

      const label = document.createElement("div");
      label.classList.add("collaboration-cursor__label");
      label.setAttribute(
        "style",
        `background-color: ${user.color}; --collaboration-user-color: ${user.color};`
      );
      label.insertBefore(document.createTextNode(user.name), null);

      container.appendChild(cursor);
      container.appendChild(label);

      return container;
    },
  });
};

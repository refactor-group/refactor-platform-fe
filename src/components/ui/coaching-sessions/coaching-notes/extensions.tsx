// TipTap v3 Extensions - Using StarterKit + additional extensions
import StarterKit from "@tiptap/starter-kit";
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
import { ConfiguredLink } from "./extended-link-extension";
import { generateCollaborativeUserColor } from "@/lib/tiptap-utils";

// Initialize lowlight with all languages
const lowlight = createLowlight(all);

// Extension to handle Tab key in code blocks
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

// Check if we have valid collaboration setup
function hasValidCollaboration(
  doc: Y.Doc | null,
  provider: TiptapCollabProvider | null | undefined
): boolean {
  return !!(provider && doc);
}

// ============================================================================
// TOP LEVEL: Story-driven main function
// ============================================================================

export const Extensions = (
  doc: Y.Doc | null,
  provider?: TiptapCollabProvider | null,
  user?: { name: string; color: string }
): TiptapExtensions => {
  try {
    const baseExtensions = createFoundationExtensions();
    const collaborativeExtensions = buildCollaborationIfValid(doc, provider, user);
    const finalExtensions = combineExtensions(baseExtensions, collaborativeExtensions);
    return validateAndReturn(finalExtensions);
  } catch (error) {
    console.error("❌ Critical error creating extensions:", error);
    return [StarterKit]; // Minimal safe fallback
  }
};

// ============================================================================
// MIDDLE LEVEL: Logical operation functions
// ============================================================================

const createFoundationExtensions = (): TiptapExtensions => {
  return [
    configureStarterKit(),
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
    logCollaborationStatus(doc, provider);
    return [];
  }

  try {
    validateYjsDocument(doc!);
    return [
      createCollaborationExtension(doc!),
      createCollaborationCaret(provider!, user),
    ];
  } catch (error) {
    console.error("❌ Error creating collaborative extensions:", error);
    console.warn("⚠️ Falling back to non-collaborative mode due to extension creation error");
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
    console.warn("⚠️ No extensions configured, using minimal StarterKit");
    return [StarterKit];
  }
  return extensions;
};

// ============================================================================
// LOW LEVEL: Specific implementation details
// ============================================================================

const configureStarterKit = () => {
  return StarterKit.configure({
    codeBlock: false, // Use custom code block
    link: false, // Use custom configured link
    undoRedo: false, // Disabled for collaboration compatibility
  });
};

const addFormattingExtensions = (): TiptapExtensions => {
  return [
    Highlight,
    TextStyle, // Required for text styling in v3
  ];
};

const addTaskListExtensions = (): TiptapExtensions => {
  return [
    TaskList,
    TaskItem.configure({ nested: true }),
  ];
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
  return ConfiguredLink;
};

const addCustomTabHandler = () => {
  return CodeBlockTabHandler;
};

const isCollaborationValid = (
  doc: Y.Doc | null,
  provider: TiptapCollabProvider | null | undefined
): boolean => {
  return !!(provider && doc);
};

const validateYjsDocument = (doc: Y.Doc) => {
  if (!doc?.clientID && doc?.clientID !== 0) {
    console.warn("⚠️ Y.js document missing clientID - may not be properly initialized");
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

const logCollaborationStatus = (
  doc: Y.Doc | null,
  provider: TiptapCollabProvider | null | undefined
) => {
  if (doc !== null || provider !== null) {
    console.warn(
      "⚠️ Collaboration not initialized - missing doc or provider:",
      { doc: !!doc, provider: !!provider }
    );
  }
};

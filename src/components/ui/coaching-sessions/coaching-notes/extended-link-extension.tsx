import Link from "@tiptap/extension-link";
import { Extension, markInputRule, markPasteRule } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

/**
 * Triggers the link creation flow by setting an empty href,
 * which causes the LinkBubbleMenu to appear for the user to fill in the URL.
 * Only works if there is a text selection.
 */
export function triggerLinkCreation(editor: Editor): boolean {
  const { from, to } = editor.state.selection;
  if (from !== to) {
    editor.chain().focus().setLink({ href: "" }).run();
    return true;
  }
  return false;
}

const LinkWithTitleAndMarkdown = Link.extend({
  name: "link",

  addAttributes() {
    return {
      href: {
        default: null,
      },
      target: {
        default: null,
      },
      rel: {
        default: null,
      },
      class: {
        default: null,
      },
      title: {
        default: null,
        renderHTML: (attributes: { href: any }) => {
          if (!attributes.href) {
            return {};
          }
          return {
            title: `Click to open ${attributes.href}`,
          };
        },
      },
    };
  },

  addInputRules() {
    return [
      // Add markdown link input rule for typing: [text](url)
      markInputRule({
        find: /\[([^\]]+)\]\(([^)]+)\)$/,
        type: this.type,
        getAttributes: (match) => {
          return {
            href: match[2],
          };
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      // Add markdown link paste rule: [text](url)
      markPasteRule({
        find: /\[([^\]]+)\]\(([^)]+)\)/g,
        type: this.type,
        getAttributes: (match) => {
          return {
            href: match[2],
          };
        },
      }),
    ];
  },
});

// Separate extension for link keyboard shortcut (Cmd-K / Ctrl-K)
export const LinkKeyboardShortcut = Extension.create({
  name: "linkKeyboardShortcut",

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => triggerLinkCreation(this.editor),
    };
  },
});

// Extension to clean up empty/zombie links automatically
// This ensures consistent behavior whether link was created via button or keyboard
export const LinkZombieCleanup = Extension.create({
  name: "linkZombieCleanup",

  onCreate() {
    let wasLinkActive = false;
    let lastHref = "";

    const cleanupEmptyLinks = () => {
      const isLinkActive = this.editor.isActive("link");

      if (isLinkActive) {
        // Track active link and its href
        const { href } = this.editor.getAttributes("link");
        lastHref = href || "";
        wasLinkActive = true;
      } else if (wasLinkActive) {
        // Link just became inactive - clean up if it had empty href
        if (!lastHref || lastHref === "") {
          const { state } = this.editor;
          const { from, to } = state.selection;
          let foundEmptyLink = false;

          // Search around cursor position for empty links
          const searchFrom = Math.max(0, from - 100);
          const searchTo = Math.min(state.doc.content.size, to + 100);

          state.doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
            if (foundEmptyLink) return false;

            const marks = node.marks;
            const linkMark = marks.find(mark => mark.type.name === "link");

            if (linkMark && (!linkMark.attrs.href || linkMark.attrs.href === "")) {
              // Remove empty link mark
              const linkFrom = pos;
              const linkTo = pos + node.nodeSize;
              this.editor
                .chain()
                .setTextSelection({ from: linkFrom, to: linkTo })
                .unsetLink()
                .setMeta("preventAutolink", true)
                .setTextSelection(this.editor.state.selection.from)
                .run();
              foundEmptyLink = true;
              return false;
            }
          });
        }

        // Reset tracking
        wasLinkActive = false;
        lastHref = "";
      }
    };

    this.editor.on("selectionUpdate", cleanupEmptyLinks);
    this.editor.on("transaction", cleanupEmptyLinks);
  },
});

export const ConfiguredLink = LinkWithTitleAndMarkdown.configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: "https",
  // Don't specify protocols - http/https are already registered by default
  // Specifying them here causes linkifyjs re-initialization warnings
  isAllowedUri: (url, ctx) => {
    // Allow empty URLs for creating new links - user will fill in the URL via BubbleMenu
    if (!url || url === "") {
      return true;
    }

    try {
      // construct URL
      const parsedUrl = url.includes(":")
        ? new URL(url)
        : new URL(`${ctx.defaultProtocol}://${url}`);

      // use default validation
      if (!ctx.defaultValidate(parsedUrl.href)) {
        return false;
      }

      // all checks have passed
      return true;
    } catch {
      return false;
    }
  },
  shouldAutoLink: (url) => {
    try {
      // construct URL
      const parsedUrl = url.includes(":")
        ? new URL(url)
        : new URL(`https://${url}`);

      return !!parsedUrl;
    } catch {
      return false;
    }
  },
});

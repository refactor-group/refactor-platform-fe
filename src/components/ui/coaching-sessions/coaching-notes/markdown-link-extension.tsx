import Link from "@tiptap/extension-link";
import { markInputRule } from "@tiptap/core";
import { markPasteRule } from "@tiptap/core";

// Extend Link to add markdown input rule while typing text to transform typed
// markdown links
export const TypedMarkdownLink = Link.extend({
  addInputRules() {
    return [
      markInputRule({
        find: /\[([^\]]+)\]\(([^)]+)\)$/,
        type: this.type,
        getAttributes: (match) => {
          return {
            href: match[2], // The URL is the second capture group
          };
        },
      }),
    ];
  },
});

// Extend Link to add markdown input rule while pasting text to transform pasted
// markdown links
export const PastedMarkdownLink = Link.extend({
  addPasteRules() {
    return [
      markPasteRule({
        find: /\[([^\]]+)\]\(([^)]+)\)/g, // Note: /g flag for paste rules
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

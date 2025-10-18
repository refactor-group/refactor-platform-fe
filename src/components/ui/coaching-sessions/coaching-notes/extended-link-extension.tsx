import Link from "@tiptap/extension-link";
import { markInputRule, markPasteRule } from "@tiptap/core";

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

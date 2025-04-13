import Link from "@tiptap/extension-link";

const LinkWithTitle = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
        renderHTML: (attributes) => {
          if (!attributes.href) {
            return {};
          }
          return {
            title: `Shift + left-click to open ${attributes.href}`,
          };
        },
      },
    };
  },
});

export const ConfiguredLink = LinkWithTitle.configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: "https",
  protocols: ["http", "https"],
  isAllowedUri: (url, ctx) => {
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

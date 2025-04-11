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
            title: `Right-click to open ${attributes.href}`,
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

      // Placeholder for future disallowed domains if we want to add any
      // const disallowedProtocols = ["ftp", "file", "mailto"];
      // const protocol = parsedUrl.protocol.replace(":", "");

      // if (disallowedProtocols.includes(protocol)) {
      //   return false;
      // }

      // // only allow protocols specified in ctx.protocols
      // const allowedProtocols = ctx.protocols.map((p) =>
      //   typeof p === "string" ? p : p.scheme
      // );

      // if (!allowedProtocols.includes(protocol)) {
      //   return false;
      // }

      // Placeholder for future disallowed domains if we want to add any
      // const disallowedDomains = [
      //   "example-phishing.com",
      //   "malicious-site.net",
      // ];
      // const domain = parsedUrl.hostname;

      // if (disallowedDomains.includes(domain)) {
      //   return false;
      // }

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

      // only auto-link if the domain is not in the disallowed list
      const disallowedDomains = [
        "example-no-autolink.com",
        "another-no-autolink.com",
      ];
      const domain = parsedUrl.hostname;

      return !disallowedDomains.includes(domain);
    } catch {
      return false;
    }
  },
});

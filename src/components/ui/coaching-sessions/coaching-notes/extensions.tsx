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
    Link.configure({
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
    }),
    Collaboration.configure({
      document: doc,
    }),
    CollaborationCursor.configure({
      provider,
    }),
  ];
};

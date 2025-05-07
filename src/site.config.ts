export const siteConfig = {
  name: "Refactor Coaching Platform",
  url: "https://refactorcoach.com",
  ogImage: "https://ui.shadcn.com/og.jpg",
  locale: "us",
  titleStyle: SessionTitleStyle.CoachFirstLastCoacheeFirstLast,
  description: "Progress is made one powerful conversation at a time.",
  links: {
    twitter: "https://www.linkedin.com/company/refactor-group/",
    github: "https://github.com/refactor-group/",
  },
  // Configuration items set via environment variables
  env: {
    backendServicePort: process.env.NEXT_PUBLIC_BACKEND_SERVICE_PORT,
    backendServiceHost: process.env.NEXT_PUBLIC_BACKEND_SERVICE_HOST,
    backendServiceURL:
      process.env.NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL +
      "://" +
      process.env.NEXT_PUBLIC_BACKEND_SERVICE_HOST +
      ":" +
      process.env.NEXT_PUBLIC_BACKEND_SERVICE_PORT,
    backendApiVersion: process.env.NEXT_PUBLIC_BACKEND_API_VERSION,
    frontendServicePort: process.env.FRONTEND_SERVICE_PORT,
    frontendServiceInterface: process.env.FRONTEND_SERVICE_INTERFACE,
    tiptapAppId: process.env.NEXT_PUBLIC_TIPTAP_APP_ID,
  },
};

export type SiteConfig = typeof siteConfig;

import { MainNavItem, SidebarNavItem } from "./types/nav";
import { SessionTitleStyle } from "./types/session-title";

interface DocsConfig {
  mainNav: MainNavItem[];
  sidebarNav: SidebarNavItem[];
}

export const docsConfig: DocsConfig = {
  mainNav: [
    {
      title: "Dashboard",
      href: "/dashboard",
    },
  ],
  sidebarNav: [
    {
      title: "User",
      items: [
        {
          title: "Profile",
          href: "/#",
          items: [],
        },
        {
          title: "Log out",
          href: "/#",
          items: [],
        },
        // {
        //   title: "Actions",
        //   items: [
        //     {
        //       title: "Log out",
        //       href: "/logout",
        //       items: [],
        //     },
        //   ],
        // },
      ],
    },
  ],
};

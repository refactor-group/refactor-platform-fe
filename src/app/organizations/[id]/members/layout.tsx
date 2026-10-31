import type { Metadata } from "next";
import "@/styles/globals.css";
import { siteConfig } from "@/site.config.ts";

import { SiteHeader } from "@/components/ui/site-header";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: "Manage coaching members",
};

export default function MembersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <SiteHeader />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

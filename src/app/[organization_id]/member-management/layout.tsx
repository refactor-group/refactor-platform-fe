import type { Metadata } from "next";
import "@/styles/globals.css";
import { siteConfig } from "@/site.config.ts";

import { SiteHeader } from "@/components/ui/site-header";
export const metadata: Metadata = {
  title: siteConfig.name,
  description: "Manage coaching members",
};

export default function MemberManagementLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Ensure that SiteHeader has enough vertical space to stay sticky at the top
    // of the page by using "min-h-screen" in the parent div
    <div className="min-h-screen">
      <SiteHeader />
      <main>{children}</main>
    </div>
  );
}

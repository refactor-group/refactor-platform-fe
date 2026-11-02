import type { ReactNode } from "react";
import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

import { SiteHeader } from "@/components/ui/site-header";

export const metadata: Metadata = {
  title: `Actions | ${siteConfig.name}`,
  description: "View and manage all your actions across coaching sessions",
};

export default function ActionsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <SiteHeader />
      {/* PageContainer's 16px is the page padding on phones; the board needs every pixel. */}
      <main className="flex-1 min-w-0 sm:p-6">{children}</main>
    </div>
  );
}

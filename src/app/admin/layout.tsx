import type { ReactNode } from "react";
import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

import { SiteHeader } from "@/components/ui/site-header";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = {
  title: `Platform Settings - ${siteConfig.name}`,
  description: "Manage platform-wide settings and organizations",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <SiteHeader />
      <main className="flex-1 p-6 min-w-0">
        <PageContainer>{children}</PageContainer>
      </main>
    </div>
  );
}

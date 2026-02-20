import type { ReactNode } from "react";
import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

import { SiteHeader } from "@/components/ui/site-header";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <SiteHeader />
          <main className="flex-1 p-6 min-w-0">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

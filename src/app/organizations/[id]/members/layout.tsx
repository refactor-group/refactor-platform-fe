import type { Metadata } from "next";
import "@/styles/globals.css";
import { siteConfig } from "@/site.config.ts";

import { SiteHeader } from "@/components/ui/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
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
    <SidebarProvider>
      <div className="flex min-h-screen min-w-full">
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

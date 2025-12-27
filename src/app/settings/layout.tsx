import type { Metadata } from "next";
import "@/styles/globals.css";
import { siteConfig } from "@/site.config.ts";

import { SiteHeader } from "@/components/ui/site-header";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: `Settings | ${siteConfig.name}`,
  description: "Manage your account and integration settings",
};

export default function SettingsLayout({
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
          <Toaster />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

import type React from "react";
import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

import { SiteHeader } from "@/components/ui/site-header";
import { PageContainer } from "@/components/ui/page-container";
import { SettingsNav } from "@/components/ui/settings/settings-nav";

export const metadata: Metadata = {
  title: `Settings - ${siteConfig.name}`,
  description: "Manage your account settings and integrations",
};

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <SiteHeader />
      <main className="flex-1 p-6 min-w-0">
        <PageContainer>
          <div className="lg:max-w-[70%]">
            {/* SettingsNav renders both mobile (horizontal tabs above)
                and desktop (vertical sidebar left) variants via responsive classes.
                Placing it inside the flex row ensures the desktop nav sits beside content. */}
            <div className="flex flex-col md:flex-row gap-8">
              <SettingsNav />
              <div className="flex-1 min-w-0">{children}</div>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}

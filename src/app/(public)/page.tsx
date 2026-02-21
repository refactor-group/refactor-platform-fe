import { Metadata } from "next";

import { siteConfig } from "@/site.config";
import { Hero } from "@/components/ui/landing/hero";
import { Features } from "@/components/ui/landing/features";
import { Footer } from "@/components/ui/landing/footer";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Hero
        siteName={siteConfig.name}
        tagline="Progress is made one powerful conversation at a time"
        description="Refactor is a coaching platform that helps coaches and their clients run structured sessions, track action items, and measure growth — all in one place."
      />
      <Features />
      <Footer
        siteName={siteConfig.name}
        companyUrl="https://www.refactorgroup.com"
        githubUrl={siteConfig.links.github}
        linkedinUrl={siteConfig.links.twitter}
      />
    </main>
  );
}

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
        tagline="The coaching OS for people-first organizations"
        description="Refactor Coach gives coaches and their clients one shared workspace to run sessions, capture commitments, and track real progress — so every conversation compounds into lasting change."
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

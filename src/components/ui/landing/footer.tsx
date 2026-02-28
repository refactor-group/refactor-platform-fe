import Link from "next/link";
import { Icons } from "@/components/ui/icons";

interface FooterProps {
  siteName: string;
  companyUrl: string;
  githubUrl: string;
  linkedinUrl: string;
}

export function Footer({
  siteName,
  companyUrl,
  githubUrl,
  linkedinUrl,
}: FooterProps) {
  return (
    <footer className="border-t px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div className="flex items-center space-x-2 text-sm">
          <Icons.refactor_logo className="h-5 w-5" />
          <span className="font-medium">{siteName}</span>
          <span className="text-muted-foreground">by</span>
          <Link
            href={companyUrl}
            className="font-medium hover:text-foreground text-muted-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Refactor Group
          </Link>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link
            href={companyUrl}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            About
          </Link>
          <Link
            href={githubUrl}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
          <Link
            href={linkedinUrl}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </Link>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { Icons } from "@/components/ui/icons";

interface HeroProps {
  siteName: string;
  tagline: string;
  description: string;
}

export function Hero({ siteName, tagline, description }: HeroProps) {
  return (
    <section className="flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
      <div className="flex items-center space-x-3 mb-6">
        <Icons.refactor_logo className="h-10 w-10" />
        <span className="text-2xl font-bold tracking-tight">{siteName}</span>
      </div>

      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
        {tagline}
      </h1>

      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        {description}
      </p>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "min-w-[160px]")}
        >
          Sign In
        </Link>
        <Link
          href="#features"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-w-[160px]"
          )}
        >
          Learn More
        </Link>
      </div>
    </section>
  );
}

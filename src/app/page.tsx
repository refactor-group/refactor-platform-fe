import { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/components/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { UserAuthForm } from "@/components/user-auth-form";
import { siteConfig } from "@/site.config";
import { Icons } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Welcome to Refactor Coaching",
  description: siteConfig.description,
};

export default function LoginPage() {
  return (
    <main>
      <div className="container relative h-[800px] flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href="#"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "hidden absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Sign Up
        </Link>
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <Link
              href="https://www.refactorcoach.com"
              className="mr-2 flex items-center space-x-2"
            >
              <div
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                  }),
                  "w-9 px-0"
                )}
              >
                <Icons.refactor_logo className="h-7 w-7" />
                <span className="sr-only">Refactor</span>
              </div>
            </Link>
            {siteConfig.name}
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">{siteConfig.description}</p>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8 sm:mt-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in to Refactor
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email & password below to sign in
              </p>
            </div>
            <UserAuthForm />
            <p className="px-8 text-center text-sm text-muted-foreground">
              By clicking continue, you agree to our{" "}
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-primary"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

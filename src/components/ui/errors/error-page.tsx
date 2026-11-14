"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { useRouter } from "next/navigation";

interface ErrorPageProps {
  icon: LucideIcon;
  /** Classes for the round icon badge, e.g. its background and icon color */
  iconClassName: string;
  title: string;
  message: string;
  showBackButton: boolean;
}

/** Full-page error state with Go Back and Go to Dashboard actions. */
export function ErrorPage({
  icon: Icon,
  iconClassName,
  title,
  message,
  showBackButton,
}: ErrorPageProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-md">
        <div
          className={cn(
            "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full",
            iconClassName
          )}
        >
          <Icon className="h-8 w-8" />
        </div>

        <h1 className="mb-4 text-2xl font-bold text-foreground">{title}</h1>

        <p className="mb-8 text-muted-foreground">{message}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showBackButton && (
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Go Back
            </Button>
          )}
          <Button onClick={() => router.push("/")} className="w-full sm:w-auto">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

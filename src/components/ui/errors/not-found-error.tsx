"use client";

import { SearchX } from "lucide-react";
import { ErrorPage } from "@/components/ui/errors/error-page";

interface NotFoundErrorProps {
  title: string;
  message: string;
}

/** Shown when a resource the page is built around returns 404. */
export function NotFoundError({ title, message }: NotFoundErrorProps) {
  return (
    <ErrorPage
      icon={SearchX}
      iconClassName="bg-fill text-muted-foreground"
      title={title}
      message={message}
      showBackButton
    />
  );
}

"use client";

import { Lock } from "lucide-react";
import { ErrorPage } from "@/components/ui/errors/error-page";

interface ForbiddenErrorProps {
  /** Optional custom title for the error */
  title?: string;
  /** Optional custom message for the error */
  message?: string;
  /** Whether to show a back button */
  showBackButton?: boolean;
}

/**
 * Error component displayed when user receives a 403 Forbidden response.
 * Shows when user tries to access a resource they don't have permission to view.
 */
export function ForbiddenError({
  title = "Access Forbidden",
  message = "You don't have permission to access this resource. Please contact your administrator if you believe this is an error.",
  showBackButton = true,
}: ForbiddenErrorProps) {
  return (
    <ErrorPage
      icon={Lock}
      iconClassName="bg-red-100 text-red-600"
      title={title}
      message={message}
      showBackButton={showBackButton}
    />
  );
}

"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-md">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Lock className="h-8 w-8 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          {title}
        </h1>

        {/* Message */}
        <p className="mb-8 text-gray-600">
          {message}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showBackButton && (
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="w-full sm:w-auto"
            >
              Go Back
            </Button>
          )}
          <Button
            onClick={handleGoHome}
            className="w-full sm:w-auto"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useGoogleOAuthConnectionStatus } from "@/lib/api/oauth-connection";
import { GoogleIntegrationSection } from "@/components/ui/settings/google-integration-section";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google account connection was cancelled.",
  exchange_failed: "Failed to connect Google account. Please try again.",
  invalid_state: "Authentication session expired. Please try again.",
};

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useGoogleOAuthConnectionStatus();

  useEffect(() => {
    const googleConnected = searchParams.get("google_connected");
    const googleError = searchParams.get("google_error");

    if (googleConnected === "true") {
      toast.success("Google account connected successfully.");
      refresh();
      router.replace("/settings/integrations", { scroll: false });
    } else if (googleError) {
      const message =
        OAUTH_ERROR_MESSAGES[googleError] ??
        "An unexpected error occurred connecting your Google account.";
      toast.error(message);
      router.replace("/settings/integrations", { scroll: false });
    }
  }, [searchParams, router, refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect external services to enhance your coaching experience.
        </p>
      </div>
      <GoogleIntegrationSection />
    </div>
  );
}

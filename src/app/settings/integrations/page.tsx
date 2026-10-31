"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useOAuthConnection } from "@/lib/api/oauth-connection";
import { Provider } from "@/types/provider";
import { MeetingIntegrationSection } from "@/components/ui/settings/meeting-integration-section";

function getErrorMessage(provider: string, errorCode: string): string {
  const messages: Record<string, string> = {
    access_denied: `${provider} connection cancelled`,
    exchange_failed: `Couldn't connect your ${provider} account · Try again`,
    invalid_state: `The connection took too long · Try again`,
  };
  return (
    messages[errorCode] ??
    `Couldn't connect your ${provider} account · Try again`
  );
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh: refreshGoogle } = useOAuthConnection(Provider.Google);
  const { refresh: refreshZoom } = useOAuthConnection(Provider.Zoom);

  useEffect(() => {
    const googleConnected = searchParams.get("google_connected");
    const googleError = searchParams.get("google_error");
    const zoomConnected = searchParams.get("zoom_connected");
    const zoomError = searchParams.get("zoom_error");

    if (googleConnected === "true") {
      toast.success("Google account connected", { id: "google-connected" });
      refreshGoogle();
      router.replace("/settings/integrations", { scroll: false });
    } else if (googleError) {
      toast.error(getErrorMessage("Google", googleError), {
        id: "google-error",
      });
      router.replace("/settings/integrations", { scroll: false });
    } else if (zoomConnected === "true") {
      toast.success("Zoom account connected", { id: "zoom-connected" });
      refreshZoom();
      router.replace("/settings/integrations", { scroll: false });
    } else if (zoomError) {
      toast.error(getErrorMessage("Zoom", zoomError), { id: "zoom-error" });
      router.replace("/settings/integrations", { scroll: false });
    }
  }, [searchParams, router, refreshGoogle, refreshZoom]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect external services to enhance your coaching experience.
        </p>
      </div>
      <MeetingIntegrationSection />
    </div>
  );
}

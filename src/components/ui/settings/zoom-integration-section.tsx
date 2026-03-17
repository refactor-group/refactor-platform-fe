"use client";

import { useState, useCallback } from "react";
import type { FC } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  OAuthConnectionApi,
  useOAuthConnection,
} from "@/lib/api/oauth-connection";
import { Provider } from "@/types/provider";
import {
  FieldSet,
  FieldGroup,
  FieldLegend,
  FieldDescription,
  Field,
  FieldLabel,
  FieldContent,
} from "@/components/kibo/ui/field";
import { Pill } from "@/components/kibo/ui/pill";
import { Button } from "@/components/ui/button";
import { ZoomDisconnectDialog } from "./zoom-disconnect-dialog";

export const ZoomIntegrationSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { connection, isLoading, refresh } = useOAuthConnection(Provider.Zoom);

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const connected = connection !== null;

  const handleConnect = useCallback(() => {
    window.location.href = OAuthConnectionApi.getAuthorizeUrl(Provider.Zoom, userId);
  }, [userId]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await OAuthConnectionApi.disconnect(Provider.Zoom);
      await refresh();
      toast.success("Zoom account disconnected.");
    } catch {
      toast.error("Failed to disconnect Zoom account.");
    } finally {
      setIsDisconnecting(false);
    }
  }, [refresh]);

  if (!isACoach) {
    return null;
  }

  return (
    <FieldSet>
      <FieldGroup>
        <FieldLegend>Meetings</FieldLegend>
        <FieldDescription>
          Connect your Zoom account to enable video calls and AI-powered session transcription.
        </FieldDescription>

        <Field orientation="horizontal">
          <FieldLabel>Zoom Account</FieldLabel>
          <FieldContent>
            {isLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : connected ? (
              <div className="flex items-center gap-3">
                <Pill>{connection.email ?? "No email on file"}</Pill>
                <ZoomDisconnectDialog
                  onConfirm={handleDisconnect}
                  isLoading={isDisconnecting}
                />
              </div>
            ) : (
              <Button onClick={handleConnect} size="sm">
                <svg viewBox="0 0 24 24" className="!h-4 !w-4 mr-1" aria-hidden="true">
                  <path d="M22.54 6.42a2.8 2.8 0 0 0-2.8-2.8H4.26a2.8 2.8 0 0 0-2.8 2.8v11.16a2.8 2.8 0 0 0 2.8 2.8h15.48a2.8 2.8 0 0 0 2.8-2.8V6.42z" fill="#2D8CFF"/>
                  <path d="M15.7 12l-4.5-3.2v6.4l4.5-3.2z" fill="#fff"/>
                </svg>
                Connect Zoom Account
              </Button>
            )}
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
};

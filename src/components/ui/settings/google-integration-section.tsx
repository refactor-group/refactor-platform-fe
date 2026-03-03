"use client";

import { useState, useCallback } from "react";
import type { FC } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  OAuthConnectionApi,
  useGoogleOAuthConnection,
} from "@/lib/api/oauth-connection";
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
import { GoogleDisconnectDialog } from "./google-disconnect-dialog";

export const GoogleIntegrationSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { connection, isLoading, refresh } = useGoogleOAuthConnection();

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const connected = connection !== null;

  const handleConnect = useCallback(() => {
    window.location.href = OAuthConnectionApi.getAuthorizeUrl(userId);
  }, [userId]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await OAuthConnectionApi.disconnectGoogle();
      await refresh();
      toast.success("Google account disconnected.");
    } catch {
      toast.error("Failed to disconnect Google account.");
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
          Connect your Google account to enable video calls and AI-powered session transcription.
        </FieldDescription>

        <Field orientation="horizontal">
          <FieldLabel>Google Account</FieldLabel>
          <FieldContent>
            {isLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : connected ? (
              <div className="flex items-center gap-3">
                <Pill>{connection?.email}</Pill>
                <GoogleDisconnectDialog
                  onConfirm={handleDisconnect}
                  isLoading={isDisconnecting}
                />
              </div>
            ) : (
              <Button onClick={handleConnect} size="sm">
                <svg viewBox="0 0 24 24" className="!h-4 !w-4 mr-1" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google Account
              </Button>
            )}
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
};

"use client";

import { useState, useCallback } from "react";
import type { FC } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  CoachingRelationshipApi,
} from "@/lib/api/coaching-relationships";
import {
  GoogleOAuthApi,
  useGoogleOAuthConnectionStatus,
} from "@/lib/api/oauth-connection";
import { MeetingApi } from "@/lib/api/meetings";
import { isGoogleOAuthConnected } from "@/types/oauth-connection";
import {
  getRelationshipsAsCoach,
  getOtherPersonName,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import {
  FieldSet,
  FieldGroup,
  FieldLegend,
  FieldDescription,
  Field,
  FieldLabel,
  FieldContent,
  FieldSeparator,
} from "@/components/kibo/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pill } from "@/components/kibo/ui/pill";
import { Button } from "@/components/ui/button";
import { GoogleDisconnectDialog } from "./google-disconnect-dialog";
import { MeetUrlField } from "./meet-url-field";

export const GoogleIntegrationSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { currentOrganizationId } = useCurrentOrganization();
  const { connectionStatus, isLoading, refresh } =
    useGoogleOAuthConnectionStatus();
  const { relationships, refresh: refreshRelationships } =
    useCoachingRelationshipList(currentOrganizationId ?? "");

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [creatingMeetForRelId, setCreatingMeetForRelId] = useState<
    string | null
  >(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");

  const connected = isGoogleOAuthConnected(connectionStatus);
  const coachRelationships = sortRelationshipsByParticipantName(
    getRelationshipsAsCoach(userId, relationships),
    userId
  );
  const selectedRelationship = coachRelationships.find(
    (r) => r.id === selectedRelationshipId
  );

  const handleConnect = useCallback(() => {
    window.location.href = GoogleOAuthApi.getAuthorizeUrl(userId);
  }, [userId]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await GoogleOAuthApi.disconnect();
      await refresh();
      toast.success("Google account disconnected.");
    } catch {
      toast.error("Failed to disconnect Google account.");
    } finally {
      setIsDisconnecting(false);
    }
  }, [refresh]);

  const handleUpdateMeetUrl = useCallback(
    async (relationshipId: string, meetUrl: string) => {
      if (!currentOrganizationId) return;
      try {
        await CoachingRelationshipApi.updateRelationship(
          currentOrganizationId,
          relationshipId,
          { meet_url: meetUrl }
        );
        await refreshRelationships();
        toast.success("Meet link saved.");
      } catch {
        toast.error("Failed to save Meet link.");
      }
    },
    [currentOrganizationId, refreshRelationships]
  );

  const handleCreateMeet = useCallback(
    async (relationshipId: string) => {
      if (!currentOrganizationId) return;
      setCreatingMeetForRelId(relationshipId);
      try {
        const space = await MeetingApi.createGoogleMeet(
          currentOrganizationId,
          relationshipId
        );
        await CoachingRelationshipApi.updateRelationship(
          currentOrganizationId,
          relationshipId,
          { meet_url: space.join_url }
        );
        await refreshRelationships();
        toast.success("Google Meet link created.");
      } catch {
        toast.error("Failed to create Google Meet link.");
      } finally {
        setCreatingMeetForRelId(null);
      }
    },
    [currentOrganizationId, refreshRelationships]
  );

  const handleRemoveMeetUrl = useCallback(
    async (relationshipId: string) => {
      if (!currentOrganizationId) return;
      try {
        await CoachingRelationshipApi.updateRelationship(
          currentOrganizationId,
          relationshipId,
          { meet_url: null }
        );
        await refreshRelationships();
        toast.success("Meet link removed.");
      } catch {
        toast.error("Failed to remove Meet link.");
      }
    },
    [currentOrganizationId, refreshRelationships]
  );

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
                <Pill>{connectionStatus.google_email}</Pill>
                <GoogleDisconnectDialog
                  onConfirm={handleDisconnect}
                  isLoading={isDisconnecting}
                />
              </div>
            ) : (
              <Button onClick={handleConnect} size="sm">
                Connect Google Account
              </Button>
            )}
          </FieldContent>
        </Field>

        {coachRelationships.length > 0 && (
          <>
            <FieldSeparator />
            <FieldGroup>
              <FieldLegend variant="label">Google Meet Links</FieldLegend>
              <FieldDescription>
                Set a video call link for each coaching relationship.
              </FieldDescription>

              <div className="flex flex-col gap-4">
                <Select
                  value={selectedRelationshipId}
                  onValueChange={setSelectedRelationshipId}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select a coachee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {coachRelationships.map((rel) => (
                      <SelectItem key={rel.id} value={rel.id}>
                        {getOtherPersonName(rel, userId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedRelationship && (
                  <MeetUrlField
                    meetUrl={selectedRelationship.meet_url}
                    isGoogleOAuthConnected={connected}
                    isCreateLoading={creatingMeetForRelId === selectedRelationship.id}
                    onUpdate={(url) => handleUpdateMeetUrl(selectedRelationship.id, url)}
                    onCreate={() => handleCreateMeet(selectedRelationship.id)}
                    onRemove={() => handleRemoveMeetUrl(selectedRelationship.id)}
                  />
                )}
              </div>
            </FieldGroup>
          </>
        )}
      </FieldGroup>
    </FieldSet>
  );
};

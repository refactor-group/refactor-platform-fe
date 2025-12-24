"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Id } from "@/types/general";
import {
  CoachingRelationshipWithUserNames,
  AiPrivacyLevel,
} from "@/types/coaching-relationship";
import { CoachingRelationshipApi } from "@/lib/api/coaching-relationships";
import { User, Video, FileText, Ban, Save, Check } from "lucide-react";
import { cn } from "@/components/lib/utils";

interface CoacheeRelationshipSettingsProps {
  userId: Id;
  relationships: CoachingRelationshipWithUserNames[];
}

/**
 * Settings component for coachees to manage their AI privacy consent.
 *
 * This component shows relationships where the user is a coachee and allows
 * them to set their own AI privacy level preference. Coachees only see their
 * own setting, not the coach's preference (for privacy).
 *
 * The effective privacy level for AI features is the minimum of both the
 * coach's and coachee's consent levels.
 */
export function CoacheeRelationshipSettings({
  userId,
  relationships,
}: CoacheeRelationshipSettingsProps) {
  // Filter to only show relationships where user is the coachee
  const coacheeRelationships = relationships.filter(r => r.coachee_id === userId);

  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>(
    coacheeRelationships.length > 0 ? coacheeRelationships[0].id : ""
  );

  if (coacheeRelationships.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          You don&apos;t have any coaching relationships as a coachee.
        </p>
      </div>
    );
  }

  const selectedRelationship = coacheeRelationships.find(
    (r) => r.id === selectedRelationshipId
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">My Privacy Settings</h3>
        <p className="text-sm text-muted-foreground">
          Control AI recording and transcription features for your coaching sessions.
          Your coach must also consent to these features for them to be available.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Select Coach</Label>
        <Select
          value={selectedRelationshipId}
          onValueChange={setSelectedRelationshipId}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a coach" />
          </SelectTrigger>
          <SelectContent>
            {coacheeRelationships.map((relationship) => (
              <SelectItem key={relationship.id} value={relationship.id}>
                {relationship.coach_first_name} {relationship.coach_last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedRelationship && (
        <CoacheeRelationshipCard
          key={selectedRelationship.id}
          relationship={selectedRelationship}
        />
      )}
    </div>
  );
}

function CoacheeRelationshipCard({
  relationship,
}: {
  relationship: CoachingRelationshipWithUserNames;
}) {
  const [privacyLevel, setPrivacyLevel] = useState<AiPrivacyLevel>(
    relationship.coachee_ai_privacy_level
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handlePrivacyLevelChange = (value: AiPrivacyLevel) => {
    setPrivacyLevel(value);
    setHasChanges(value !== relationship.coachee_ai_privacy_level);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await CoachingRelationshipApi.update(relationship.id, {
        coachee_ai_privacy_level: privacyLevel,
      });
      toast.success("Privacy settings saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save privacy settings");
      console.error("Error saving coachee privacy settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const coachName = `${relationship.coach_first_name} ${relationship.coach_last_name}`;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{coachName}</p>
          <p className="text-sm text-muted-foreground">Coach</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>My AI Consent Level</Label>
        <p className="text-xs text-muted-foreground">
          The most restrictive choice between you and {relationship.coach_first_name} will be respected
        </p>
        <div className="space-y-3">
          <PrivacyOption
            value={AiPrivacyLevel.Full}
            selected={privacyLevel === AiPrivacyLevel.Full}
            onClick={() => handlePrivacyLevelChange(AiPrivacyLevel.Full)}
            icon={<Video className="h-4 w-4 text-green-600" />}
            label="Full"
            sublabel="(Default)"
            description="I consent to full recording with video, transcript, and AI features"
            constraintNote={
              relationship.coach_ai_privacy_level === AiPrivacyLevel.Full
                ? `${relationship.coach_first_name}'s choice`
                : undefined
            }
          />
          <PrivacyOption
            value={AiPrivacyLevel.TranscribeOnly}
            selected={privacyLevel === AiPrivacyLevel.TranscribeOnly}
            onClick={() => handlePrivacyLevelChange(AiPrivacyLevel.TranscribeOnly)}
            icon={<FileText className="h-4 w-4 text-blue-600" />}
            label="Transcribe Only"
            description="I consent to text transcription only, no video/audio storage"
            constraintNote={
              relationship.coach_ai_privacy_level === AiPrivacyLevel.TranscribeOnly
                ? `${relationship.coach_first_name}'s choice`
                : undefined
            }
          />
          <PrivacyOption
            value={AiPrivacyLevel.None}
            selected={privacyLevel === AiPrivacyLevel.None}
            onClick={() => handlePrivacyLevelChange(AiPrivacyLevel.None)}
            icon={<Ban className="h-4 w-4 text-red-600" />}
            label="None"
            description="I do not consent to any AI recording or transcription"
            constraintNote={
              relationship.coach_ai_privacy_level === AiPrivacyLevel.None
                ? `${relationship.coach_first_name}'s choice`
                : undefined
            }
          />
        </div>
      </div>

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface PrivacyOptionProps {
  value: AiPrivacyLevel;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  description: string;
  constraintNote?: string;
}

function PrivacyOption({
  selected,
  onClick,
  icon,
  label,
  sublabel,
  description,
  constraintNote,
}: PrivacyOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start space-x-3 p-3 border rounded-lg w-full text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "hover:bg-muted/50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center",
          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}
      >
        {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {icon}
          <span className="font-medium">{label}</span>
          {sublabel && (
            <span className="text-xs text-muted-foreground">{sublabel}</span>
          )}
          {constraintNote && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ({constraintNote})
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}

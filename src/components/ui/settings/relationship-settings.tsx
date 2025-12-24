"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface RelationshipSettingsProps {
  userId: Id;
  relationships: CoachingRelationshipWithUserNames[];
}

export function RelationshipSettings({
  userId,
  relationships,
}: RelationshipSettingsProps) {
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>(
    relationships.length > 0 ? relationships[0].id : ""
  );

  if (relationships.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          You don&apos;t have any coaching relationships yet.
        </p>
      </div>
    );
  }

  const selectedRelationship = relationships.find(
    (r) => r.id === selectedRelationshipId
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Coaching Relationships</h3>
        <p className="text-sm text-muted-foreground">
          Configure meeting settings and AI privacy levels for your coachees
        </p>
      </div>

      <div className="space-y-2">
        <Label>Select Coachee</Label>
        <Select
          value={selectedRelationshipId}
          onValueChange={setSelectedRelationshipId}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a coachee" />
          </SelectTrigger>
          <SelectContent>
            {relationships.map((relationship) => (
              <SelectItem key={relationship.id} value={relationship.id}>
                {relationship.coachee_first_name} {relationship.coachee_last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedRelationship && (
        <RelationshipCard
          key={selectedRelationship.id}
          relationship={selectedRelationship}
        />
      )}
    </div>
  );
}

function RelationshipCard({
  relationship,
}: {
  relationship: CoachingRelationshipWithUserNames;
}) {
  const [meetingUrl, setMeetingUrl] = useState(relationship.meeting_url || "");
  const [privacyLevel, setPrivacyLevel] = useState<AiPrivacyLevel>(
    relationship.coach_ai_privacy_level
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleMeetingUrlChange = (value: string) => {
    setMeetingUrl(value);
    setHasChanges(
      value !== (relationship.meeting_url || "") ||
        privacyLevel !== relationship.coach_ai_privacy_level
    );
  };

  const handlePrivacyLevelChange = (value: AiPrivacyLevel) => {
    setPrivacyLevel(value);
    setHasChanges(
      meetingUrl !== (relationship.meeting_url || "") ||
        value !== relationship.coach_ai_privacy_level
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await CoachingRelationshipApi.update(relationship.id, {
        meeting_url: meetingUrl || null,
        coach_ai_privacy_level: privacyLevel,
      });
      toast.success("Settings saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Error saving relationship settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const coacheeName = `${relationship.coachee_first_name} ${relationship.coachee_last_name}`;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{coacheeName}</p>
          <p className="text-sm text-muted-foreground">Coachee</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`meeting-url-${relationship.id}`}>Google Meet URL</Label>
        <Input
          id={`meeting-url-${relationship.id}`}
          type="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          value={meetingUrl}
          onChange={(e) => handleMeetingUrlChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The Google Meet link for your coaching sessions with this coachee
        </p>
      </div>

      <div className="space-y-3">
        <Label>AI Privacy Level</Label>
        <div className="space-y-3">
          <PrivacyOption
            value={AiPrivacyLevel.Full}
            selected={privacyLevel === AiPrivacyLevel.Full}
            onClick={() => handlePrivacyLevelChange(AiPrivacyLevel.Full)}
            icon={<Video className="h-4 w-4 text-green-600" />}
            label="Full"
            sublabel="(Default)"
            description="Full recording with video, transcript, and AI features"
          />
          <PrivacyOption
            value={AiPrivacyLevel.TranscribeOnly}
            selected={privacyLevel === AiPrivacyLevel.TranscribeOnly}
            onClick={() => handlePrivacyLevelChange(AiPrivacyLevel.TranscribeOnly)}
            icon={<FileText className="h-4 w-4 text-blue-600" />}
            label="Transcribe Only"
            description="Text transcription only, no video/audio storage"
          />
          <PrivacyOption
            value={AiPrivacyLevel.None}
            selected={privacyLevel === AiPrivacyLevel.None}
            onClick={() => handlePrivacyLevelChange(AiPrivacyLevel.None)}
            icon={<Ban className="h-4 w-4 text-red-600" />}
            label="None"
            description="No AI recording or transcribing for clients who prefer no AI"
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
}

function PrivacyOption({
  selected,
  onClick,
  icon,
  label,
  sublabel,
  description,
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
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          {sublabel && (
            <span className="text-xs text-muted-foreground">{sublabel}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}

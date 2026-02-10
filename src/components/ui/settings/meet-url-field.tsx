"use client";

import { useState, useCallback } from "react";
import type { FC } from "react";
import { Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GOOGLE_MEET_URL_PATTERN =
  /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

interface MeetUrlFieldProps {
  meetUrl?: string;
  isGoogleOAuthConnected: boolean;
  isCreateLoading?: boolean;
  onUpdate: (meetUrl: string) => Promise<void>;
  onCreate: () => Promise<void>;
  onRemove: () => Promise<void>;
}

export const MeetUrlField: FC<MeetUrlFieldProps> = ({
  meetUrl,
  isGoogleOAuthConnected,
  isCreateLoading = false,
  onUpdate,
  onCreate,
  onRemove,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validateAndSave = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (!GOOGLE_MEET_URL_PATTERN.test(trimmed)) {
      setValidationError(
        "Please enter a valid Google Meet URL (e.g. https://meet.google.com/abc-defg-hij)"
      );
      return;
    }

    setValidationError(null);
    setIsSaving(true);
    try {
      await onUpdate(trimmed);
      setInputValue("");
    } finally {
      setIsSaving(false);
    }
  }, [inputValue, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        validateAndSave();
      }
    },
    [validateAndSave]
  );

  const handleCopy = useCallback(async () => {
    if (!meetUrl) return;
    try {
      await navigator.clipboard.writeText(meetUrl);
      toast.success("Meet link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }, [meetUrl]);

  if (meetUrl) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={meetUrl}
          readOnly
          className="flex-1 bg-muted text-muted-foreground"
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (validationError) setValidationError(null);
          }}
          onBlur={validateAndSave}
          onKeyDown={handleKeyDown}
          placeholder="Paste Google Meet URL"
          disabled={isSaving}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onCreate}
          disabled={!isGoogleOAuthConnected || isCreateLoading}
        >
          {isCreateLoading ? "Creating..." : "Create Meet"}
        </Button>
      </div>
      {validationError && (
        <p className="text-destructive text-sm">{validationError}</p>
      )}
    </div>
  );
};

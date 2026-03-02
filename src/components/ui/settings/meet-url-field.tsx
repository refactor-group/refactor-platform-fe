"use client";

import { useCallback } from "react";
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

interface MeetUrlFieldProps {
  meetUrl?: string;
  isGoogleOAuthConnected: boolean;
  isCreateLoading?: boolean;
  onCreate: () => Promise<void>;
  onRemove: () => Promise<void>;
}

export const MeetUrlField: FC<MeetUrlFieldProps> = ({
  meetUrl,
  isGoogleOAuthConnected,
  isCreateLoading = false,
  onCreate,
  onRemove,
}) => {
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
    <Button
      variant="outline"
      size="sm"
      onClick={onCreate}
      disabled={!isGoogleOAuthConnected || isCreateLoading}
    >
      {isCreateLoading ? "Creating..." : "Create Meet"}
    </Button>
  );
};

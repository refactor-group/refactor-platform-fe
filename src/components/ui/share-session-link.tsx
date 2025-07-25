"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Core copy functionality without UI feedback
export async function copyCoachingSessionLink(sessionId: string): Promise<void> {
  const url = `${window.location.origin}/coaching-sessions/${sessionId}`;
  await navigator.clipboard.writeText(url);
}

// Legacy version with toast for backward compatibility
export async function copyCoachingSessionLinkWithToast(sessionId: string): Promise<void> {
  const { toast } = await import("sonner");
  try {
    await copyCoachingSessionLink(sessionId);
    toast("Coaching session link copied successfully.");
  } catch (error) {
    console.error("Failed to copy link:", error);
    throw error;
  }
}

interface ShareSessionLinkProps {
  sessionId: string;
  className?: string;
  onError?: (error: Error) => void;
}

export default function ShareSessionLink({ sessionId, className, onError }: ShareSessionLinkProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await copyCoachingSessionLink(sessionId);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      onError?.(error as Error);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={isCopied ? "sm" : "icon"}
            onClick={handleCopyLink}
            className={`${isCopied ? "px-3" : "h-8 w-8"} ${className || ""}`}
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              <Share className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to share link to this coaching session</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
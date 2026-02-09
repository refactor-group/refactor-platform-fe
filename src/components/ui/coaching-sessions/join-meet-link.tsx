"use client";

import type { FC } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JoinMeetLinkProps {
  meetUrl?: string;
}

const JoinMeetLink: FC<JoinMeetLinkProps> = ({ meetUrl }) => {
  if (!meetUrl) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled
              className="h-10 w-10"
            >
              <Video className="!h-6 !w-6 text-muted-foreground opacity-50" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Set up a Google Meet link in Settings &gt; Integrations</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            asChild
          >
            <a href={meetUrl} target="_blank" rel="noopener noreferrer">
              <Video className="!h-6 !w-6" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Join Meeting</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default JoinMeetLink;

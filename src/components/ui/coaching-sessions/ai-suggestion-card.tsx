"use client";

import { useState } from "react";
import { Check, X, Loader2, Target, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/lib/utils";
import { AiSuggestedItem, AiSuggestionType } from "@/types/meeting-recording";
import { useAiSuggestionMutation } from "@/lib/api/ai-suggestions";
import { toast } from "sonner";

interface AiSuggestionCardProps {
  suggestion: AiSuggestedItem;
  onAction?: () => void;
  className?: string;
}

/**
 * Renders a single AI suggestion with accept/dismiss actions.
 * When accepted, creates the corresponding Action or Agreement.
 */
export function AiSuggestionCard({
  suggestion,
  onAction,
  className,
}: AiSuggestionCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const { accept, dismiss } = useAiSuggestionMutation();

  const isAction = suggestion.item_type === AiSuggestionType.Action;
  const Icon = isAction ? Target : Handshake;
  const typeLabel = isAction ? "Action" : "Agreement";

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const result = await accept(suggestion.id);
      toast.success(`${typeLabel} added successfully`, {
        description: `Created new ${result.entity_type} from AI suggestion.`,
      });
      onAction?.();
    } catch (error) {
      toast.error(`Failed to add ${typeLabel.toLowerCase()}`, {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await dismiss(suggestion.id);
      toast.info("Suggestion dismissed");
      onAction?.();
    } catch (error) {
      toast.error("Failed to dismiss suggestion", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDismissing(false);
    }
  };

  const isLoading = isAccepting || isDismissing;

  return (
    <Card className={cn("border-l-4", isAction ? "border-l-blue-500" : "border-l-green-500", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 p-2 rounded-full",
            isAction ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              isAction ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {typeLabel}
              </Badge>
              {suggestion.confidence && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(suggestion.confidence * 100)}% confident
                </span>
              )}
            </div>
            <p className="text-sm text-foreground">{suggestion.content}</p>
            {suggestion.source_text && (
              <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
                &ldquo;{suggestion.source_text}&rdquo;
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAccept}
              disabled={isLoading}
              className="h-8 gap-1"
            >
              {isAccepting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isLoading}
              className="h-8 gap-1 text-muted-foreground hover:text-destructive"
            >
              {isDismissing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

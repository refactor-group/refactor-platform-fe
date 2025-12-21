"use client";

import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSuggestedItem, AiSuggestionType } from "@/types/meeting-recording";
import { AiSuggestionCard } from "./ai-suggestion-card";

interface AiSuggestionsPanelProps {
  suggestions: AiSuggestedItem[];
  onSuggestionAction?: () => void;
}

/**
 * Panel displaying AI-detected actions and agreements.
 * Groups suggestions by type and provides accept/dismiss actions.
 */
export function AiSuggestionsPanel({
  suggestions,
  onSuggestionAction,
}: AiSuggestionsPanelProps) {
  // Group suggestions by type
  const actions = suggestions.filter((s) => s.item_type === AiSuggestionType.Action);
  const agreements = suggestions.filter((s) => s.item_type === AiSuggestionType.Agreement);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5 text-primary" />
          AI-Detected Items
          <span className="text-sm font-normal text-muted-foreground">
            ({suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Items */}
        {actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Action Items ({actions.length})
            </h4>
            <div className="space-y-2">
              {actions.map((suggestion) => (
                <AiSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAction={onSuggestionAction}
                />
              ))}
            </div>
          </div>
        )}

        {/* Agreements */}
        {agreements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Agreements ({agreements.length})
            </h4>
            <div className="space-y-2">
              {agreements.map((suggestion) => (
                <AiSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAction={onSuggestionAction}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

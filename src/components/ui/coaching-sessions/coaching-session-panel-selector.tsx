"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PanelSection = "goals" | "agreements";

export interface CoachingSessionPanelSelectorProps {
  activeSection: PanelSection;
  onSectionChange: (section: PanelSection) => void;
  goalsLabel: string;
  agreementsLabel: string;
}

export function CoachingSessionPanelSelector({
  activeSection,
  onSectionChange,
  goalsLabel,
  agreementsLabel,
}: CoachingSessionPanelSelectorProps) {
  const labels: Record<PanelSection, string> = {
    goals: goalsLabel,
    agreements: agreementsLabel,
  };

  return (
    <Select
      value={activeSection}
      onValueChange={(value) => onSectionChange(value as PanelSection)}
    >
      <SelectTrigger className="h-8 w-auto gap-1.5 rounded-md border-none bg-transparent px-2.5 text-sm font-semibold shadow-none hover:bg-accent hover:text-accent-foreground focus:ring-0 focus:ring-offset-0 transition-colors">
        <SelectValue>{labels[activeSection]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="goals">{goalsLabel}</SelectItem>
        <SelectItem value="agreements">{agreementsLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export enum PanelSection {
  Goals = "goals",
  Agreements = "agreements",
}

const SECTION_NAMES: Record<PanelSection, string> = {
  [PanelSection.Goals]: "Goals",
  [PanelSection.Agreements]: "Agreements",
};

const ALL_SECTIONS = Object.values(PanelSection);

export interface CoachingSessionPanelSelectorProps {
  activeSection: PanelSection;
  onSectionChange: (section: PanelSection) => void;
  counts: Record<PanelSection, string>;
}

function SectionLabel({ name, count }: { name: string; count: string }) {
  return (
    <span>
      {name}
      {count && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          {count}
        </span>
      )}
    </span>
  );
}

export function CoachingSessionPanelSelector({
  activeSection,
  onSectionChange,
  counts,
}: CoachingSessionPanelSelectorProps) {
  return (
    <Select
      value={activeSection}
      onValueChange={(value) => onSectionChange(value as PanelSection)}
    >
      <SelectTrigger className="h-8 w-auto gap-1.5 rounded-md border-none bg-transparent px-2.5 text-sm font-semibold shadow-none hover:bg-accent hover:text-accent-foreground focus:ring-0 focus:ring-offset-0 transition-colors">
        <SelectValue>
          <SectionLabel name={SECTION_NAMES[activeSection]} count={counts[activeSection]} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ALL_SECTIONS.map((section) => (
          <SelectItem key={section} value={section}>
            <SectionLabel name={SECTION_NAMES[section]} count={counts[section]} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ListFilter } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { PersonSearchField, PersonSearchSize } from "@/components/ui/person-search";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PersonGroup,
  filterLabel,
  filterSections,
  type FilterPerson,
  type FilterSection,
} from "@/lib/week-grid/filter";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

export interface WeekFilterProps {
  people: FilterPerson[];
  selected: Option<FilterPerson>;
  onSelect: (userId: Id) => void;
  onClear: () => void;
}

export function WeekFilter({ people, selected, onSelect, onClear }: WeekFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };
  const choose = (pick: () => void) => {
    pick();
    onOpenChange(false);
  };
  const sections = filterSections(people, query);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="max-w-[240px] text-[13px]">
          <ListFilter aria-hidden />
          <span className="truncate">{filterLabel(selected)}</span>
          <ChevronDown aria-hidden className="text-faint" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[280px] p-1.5">
        <PersonSearchField query={query} onQueryChange={setQuery} size={PersonSearchSize.Compact} />
        <div className="mt-1.5 max-h-[300px] overflow-y-auto">
          <div role="listbox" aria-label="Filter by person">
            <FilterOption selected={selected.none} muted={false} onChoose={() => choose(onClear)}>
              All sessions
            </FilterOption>
            {sections.map((section) => (
              <FilterGroup
                key={section.group}
                section={section}
                selected={selected}
                onChoose={(userId) => choose(() => onSelect(userId))}
              />
            ))}
          </div>
          {sections.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">No one matches.</p>
          )}
        </div>
        <p className="border-t border-hairline px-2.5 pb-1 pt-2 text-[11.5px] text-faint">
          Applies to every week you page to.
        </p>
      </PopoverContent>
    </Popover>
  );
}

interface FilterGroupProps {
  section: FilterSection;
  selected: Option<FilterPerson>;
  onChoose: (userId: Id) => void;
}

function FilterGroup({ section, selected, onChoose }: FilterGroupProps) {
  const muted = section.group === PersonGroup.Inactive;
  return (
    <div role="group" aria-label={section.label} className="mt-1.5">
      <div aria-hidden className="px-2.5 pb-1 pt-1.5 text-tiny text-muted-foreground">
        {section.label}
      </div>
      {section.people.map((person) => (
        <FilterOption
          key={person.userId}
          selected={selected.some && selected.val.userId === person.userId}
          muted={muted}
          onChoose={() => onChoose(person.userId)}
        >
          {person.fullName}
        </FilterOption>
      ))}
    </div>
  );
}

interface FilterOptionProps {
  selected: boolean;
  muted: boolean;
  onChoose: () => void;
  children: ReactNode;
}

function FilterOption({ selected, muted, onChoose, children }: FilterOptionProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onChoose}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-item transition-colors duration-150 hover:bg-well focus-visible:bg-fill focus-visible:outline-none motion-reduce:transition-none",
        muted ? "text-muted-foreground" : "text-foreground"
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-brand" />}
    </button>
  );
}

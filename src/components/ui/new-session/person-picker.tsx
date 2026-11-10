"use client";

import { useState } from "react";
import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import { CheckDisc } from "@/components/ui/check-disc";
import { PersonSearchField, PersonSearchSize } from "@/components/ui/person-search";
import { matchesPersonName } from "@/lib/people";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

export interface PickerPerson {
  userId: Id;
  fullName: string;
  initials: string;
  subline: string;
  inactive: boolean;
}

interface PersonPickerProps {
  /** Shown in the order given. */
  people: PickerPerson[];
  selectedId: Option<Id>;
  onSelect: (userId: Id) => void;
}

const isSelected = (person: PickerPerson, selectedId: Option<Id>): boolean =>
  selectedId.some && selectedId.val === person.userId;

function visiblePeople(
  people: PickerPerson[],
  query: string,
  showInactive: boolean,
  selectedId: Option<Id>
): PickerPerson[] {
  if (query.trim()) return people.filter((p) => matchesPersonName(p.fullName, query));
  return people.filter((p) => !p.inactive || showInactive || isSelected(p, selectedId));
}

const CLOCK_TIME = /(\d{1,2}:\d{2} [AP]M)/;

/** Keeps "10:00 AM" on one line. */
function Subline({ text }: { text: string }) {
  return text.split(CLOCK_TIME).map((part, index) =>
    CLOCK_TIME.test(part) ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    )
  );
}

interface PersonCardProps {
  person: PickerPerson;
  selected: boolean;
  onSelect: (userId: Id) => void;
}

function PersonCard({ person, selected, onSelect }: PersonCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(person.userId)}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        selected && "bg-card",
        person.inactive && !selected && "opacity-55"
      )}
    >
      <PersonAvatar userId={person.userId} initials={person.initials} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 break-words text-sm font-medium text-foreground">{person.fullName}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground tabular-nums">
          <Subline text={person.subline} />
        </span>
      </span>
      {selected && <CheckDisc size={20} tone="brand" />}
    </button>
  );
}

interface InactiveToggleProps {
  count: number;
  showing: boolean;
  onToggle: () => void;
}

function InactiveToggle({ count, showing, onToggle }: InactiveToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "mt-3 inline-flex h-11 items-center rounded-sm text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring modal:h-auto",
        showing ? "text-muted-foreground" : "text-brand"
      )}
    >
      {showing ? "Hide inactive" : `Show everyone (+${count} inactive)`}
    </button>
  );
}

export function PersonPicker({ people, selectedId, onSelect }: PersonPickerProps) {
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const shown = visiblePeople(people, query, showInactive, selectedId);
  const inactiveCount = people.filter((p) => p.inactive).length;
  const searching = query.trim() !== "";

  return (
    <div>
      <PersonSearchField query={query} onQueryChange={setQuery} size={PersonSearchSize.Regular} />
      {shown.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No matches</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 modal:grid-cols-2">
          {shown.map((person) => (
            <PersonCard
              key={person.userId}
              person={person}
              selected={isSelected(person, selectedId)}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      {!searching && inactiveCount > 0 && (
        <InactiveToggle
          count={inactiveCount}
          showing={showInactive}
          onToggle={() => setShowInactive((showing) => !showing)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import { CheckDisc } from "@/components/ui/check-disc";
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
  const needle = query.trim().toLowerCase();
  if (needle) return people.filter((p) => p.fullName.toLowerCase().includes(needle));
  return people.filter((p) => !p.inactive || showInactive || isSelected(p, selectedId));
}

function SearchField({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  return (
    <div className="relative max-w-[360px]">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
      />
      <input
        type="search"
        aria-label="Find a person"
        placeholder="Find a person"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="h-11 w-full rounded-input border bg-card pl-9 pr-3 text-item transition-colors duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring modal:h-10 motion-reduce:transition-none"
      />
    </div>
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
        person.inactive && "opacity-55"
      )}
    >
      <PersonAvatar userId={person.userId} initials={person.initials} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{person.fullName}</span>
        <span className="truncate text-xs text-muted-foreground tabular-nums">{person.subline}</span>
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
      <SearchField query={query} onQueryChange={setQuery} />
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

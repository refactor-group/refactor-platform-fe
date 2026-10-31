import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { MenuPerson } from "@/components/ui/join-session/types";
import type { Id } from "@/types/general";

export const PEOPLE_PER_PAGE = 5;
const CARD_STRIDE_PX = 71;

interface PersonCarouselProps {
  people: MenuPerson[];
  selectedId: Id;
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (userId: Id) => void;
}

export function pageCount(people: number): number {
  return Math.max(1, Math.ceil(people / PEOPLE_PER_PAGE));
}

export function clampPage(page: number, people: number): number {
  return Math.min(Math.max(page, 0), pageCount(people) - 1);
}

export function pageOf(userId: Id, people: MenuPerson[]): number {
  const index = people.findIndex((person) => person.userId === userId);
  return index < 0 ? 0 : Math.floor(index / PEOPLE_PER_PAGE);
}

interface PersonCardProps {
  person: MenuPerson;
  selected: boolean;
  onPage: boolean;
  onSelect: (userId: Id) => void;
}

function PersonCard({ person, selected, onPage, onSelect }: PersonCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      inert={!onPage}
      onClick={() => onSelect(person.userId)}
      className="flex w-[68px] flex-none flex-col items-center gap-[5px] rounded-input px-1 py-1.5 transition-colors duration-150 hover:bg-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <PersonAvatar
        userId={person.userId}
        initials={person.initials}
        size={36}
        selected={selected}
      />
      <span
        className={cn(
          "w-full truncate text-center text-pill font-medium",
          selected ? "text-foreground" : "text-ink-2"
        )}
      >
        {person.firstName}
      </span>
    </button>
  );
}

export function PersonCarousel({
  people,
  selectedId,
  page,
  onPageChange,
  onSelect,
}: PersonCarouselProps) {
  const lastPage = pageCount(people.length) - 1;
  const onPage = (index: number) => Math.floor(index / PEOPLE_PER_PAGE) === page;

  return (
    <div className="flex items-center px-1.5 pb-1 pt-2">
      <Button
        variant="ghost"
        size="icon-menu"
        aria-label="Previous people"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className="flex gap-[3px] transition-transform duration-[250ms] ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${page * PEOPLE_PER_PAGE * CARD_STRIDE_PX}px)` }}
        >
          {people.map((person, index) => (
            <PersonCard
              key={person.userId}
              person={person}
              selected={person.userId === selectedId}
              onPage={onPage(index)}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-menu"
        aria-label="Next people"
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

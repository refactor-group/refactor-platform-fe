import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CarouselPerson, WhenLine } from "@/components/ui/join-session/types";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

export const PEOPLE_PER_PAGE = 5;
const CARD_GAP_PX = 3;
// A page always fits the track: 68px cards in the 420px menu, narrower on phones.
const CARD_WIDTH = `calc((100% - ${(PEOPLE_PER_PAGE - 1) * CARD_GAP_PX}px) / ${PEOPLE_PER_PAGE})`;

const CARD =
  "flex flex-none flex-col items-center gap-1 rounded-input px-1 py-1.5 transition-colors duration-150 hover:bg-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const WHEN = "w-full truncate text-center text-[10.5px] leading-[1.3] tabular-nums";

const WHEN_TONE: Record<WhenLine["tone"], string> = {
  accent: "text-brand",
  muted: "text-muted-foreground",
  faint: "text-faint",
};

interface PersonCarouselProps {
  people: CarouselPerson[];
  /** Inactive people behind the trailing card; 0 renders no card. */
  hiddenInactive: number;
  onShowInactive: () => void;
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

export function pageOf(userId: Id, people: CarouselPerson[]): number {
  const index = people.findIndex((entry) => entry.person.userId === userId);
  return index < 0 ? 0 : Math.floor(index / PEOPLE_PER_PAGE);
}

/** The card count, including the trailing inactive card. */
export function cardCount(people: number, hiddenInactive: number): number {
  return people + (hiddenInactive > 0 ? 1 : 0);
}

function When({ line }: { line: Option<WhenLine> }) {
  // A blank line while loading keeps the cards from changing height.
  return line.some ? (
    <span className={cn(WHEN, WHEN_TONE[line.val.tone])}>{line.val.text}</span>
  ) : (
    <span aria-hidden className={WHEN}>{"\u00a0"}</span>
  );
}

interface PersonCardProps {
  entry: CarouselPerson;
  selected: boolean;
  onPage: boolean;
  onSelect: (userId: Id) => void;
}

function PersonCard({ entry, selected, onPage, onSelect }: PersonCardProps) {
  const { person } = entry;
  return (
    <button
      type="button"
      aria-pressed={selected}
      inert={!onPage}
      onClick={() => onSelect(person.userId)}
      style={{ width: CARD_WIDTH }}
      className={cn(CARD, entry.inactive && "opacity-55")}
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
      <When line={entry.when} />
    </button>
  );
}

interface InactiveCardProps {
  count: number;
  onPage: boolean;
  onShow: () => void;
}

function InactiveCard({ count, onPage, onShow }: InactiveCardProps) {
  return (
    <button
      type="button"
      aria-label={`Show ${count} inactive`}
      inert={!onPage}
      onClick={onShow}
      style={{ width: CARD_WIDTH }}
      className={cn(CARD, "justify-center")}
    >
      <span className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-dashed border-border-hover text-tiny font-semibold text-muted-foreground">
        +{count}
      </span>
      <span className="w-full truncate text-center text-pill font-medium text-muted-foreground">
        Inactive
      </span>
      <span className={cn(WHEN, "text-faint")}>Show</span>
    </button>
  );
}

export function PersonCarousel({
  people,
  hiddenInactive,
  onShowInactive,
  selectedId,
  page,
  onPageChange,
  onSelect,
}: PersonCarouselProps) {
  const lastPage = pageCount(cardCount(people.length, hiddenInactive)) - 1;
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
          className="flex transition-transform duration-[250ms] ease-out motion-reduce:transition-none"
          style={{
            gap: CARD_GAP_PX,
            // Each page is one track width plus the gap after its last card.
            transform: `translateX(calc(${page} * (-100% - ${CARD_GAP_PX}px)))`,
          }}
        >
          {people.map((entry, index) => (
            <PersonCard
              key={entry.person.userId}
              entry={entry}
              selected={entry.person.userId === selectedId}
              onPage={onPage(index)}
              onSelect={onSelect}
            />
          ))}
          {hiddenInactive > 0 && (
            <InactiveCard
              count={hiddenInactive}
              onPage={onPage(people.length)}
              onShow={onShowInactive}
            />
          )}
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

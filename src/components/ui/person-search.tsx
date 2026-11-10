import { Search } from "lucide-react";
import { cn } from "@/components/lib/utils";

export enum PersonSearchSize {
  Regular = "regular",
  Compact = "compact",
}

export interface PersonSearchFieldProps {
  query: string;
  onQueryChange: (query: string) => void;
  size: PersonSearchSize;
}

function sizeClasses(size: PersonSearchSize): { wrapper: string; input: string } {
  switch (size) {
    case PersonSearchSize.Regular:
      return { wrapper: "max-w-[360px]", input: "h-11 modal:h-10" };
    case PersonSearchSize.Compact:
      return { wrapper: "w-full", input: "h-8" };
    default: {
      const _exhaustive: never = size;
      throw new Error(`Unhandled person search size: ${_exhaustive}`);
    }
  }
}

export function PersonSearchField({ query, onQueryChange, size }: PersonSearchFieldProps) {
  const classes = sizeClasses(size);
  return (
    <div className={cn("relative", classes.wrapper)}>
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
        className={cn(
          "w-full rounded-input border bg-card pl-9 pr-3 text-item transition-colors duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          classes.input
        )}
      />
    </div>
  );
}

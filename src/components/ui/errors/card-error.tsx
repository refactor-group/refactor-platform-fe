import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Option } from "@/types/option";

interface CardErrorProps {
  title: string;
  /** None hides "Try again", e.g. for a permission error that retrying won't fix. */
  retry: Option<() => void>;
}

/** Error body for a card: alert badge, title, and an optional Try again pill. Renders inside the card's own chrome. */
export function CardError({ title, retry }: CardErrorProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="my-auto">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-error-tint text-error">
          <CircleAlert className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <p role="alert" className="mt-3 text-sm font-medium text-foreground">
          {title}
        </p>
      </div>
      {retry.some && (
        <Button
          variant="secondary"
          className="mt-auto w-full min-h-11 sm:min-h-10"
          // Drop the click event so an SWR mutator isn't handed it as new data.
          onClick={() => retry.val()}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

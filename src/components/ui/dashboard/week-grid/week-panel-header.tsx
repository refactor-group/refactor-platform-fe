import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { type Option, None } from "@/types/option";
import { WeekFilter, type WeekFilterProps } from "./week-filter";

export interface WeekNavigation {
  canGoEarlier: boolean;
  canGoLater: boolean;
  isCurrentWeek: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onThisWeek: () => void;
}

export interface WeekPanelHeaderProps {
  titleId: string;
  title: string;
  range: string;
  subline: Option<string>;
  navigation: WeekNavigation;
  filter: Option<WeekFilterProps>;
  onSchedule: Option<() => void>;
  /** The server can't be reached, so Schedule session stays visible but disabled. */
  readOnly: boolean;
}

export function WeekPanelHeader({
  titleId,
  title,
  range,
  subline,
  navigation,
  filter,
  onSchedule,
  readOnly,
}: WeekPanelHeaderProps) {
  const chip = filter.some && filter.val.selected.some ? filter.val.selected : None;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div>
        {/* Below lg the link spans the title and range lines, so wrapping never adds height. */}
        <div className="grid grid-cols-[auto_1fr] gap-x-3 lg:flex lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-y-3">
          <h2 id={titleId} className="col-start-1 row-start-1 text-section font-normal">
            {title}
          </h2>
          {!navigation.isCurrentWeek && <BackToCurrentWeek onClick={navigation.onThisWeek} />}
          <span className="col-start-1 row-start-2 text-card-title tabular-nums text-ink-2">{range}</span>
        </div>
        {/* Below lg the row keeps its height while loading, so the arrows hold still. */}
        <div className={cn("mt-1 flex flex-wrap items-center gap-2", subline.none && chip.none && "lg:hidden")}>
          {subline.some ? (
            <p className="text-sm tabular-nums text-muted-foreground">{subline.val}</p>
          ) : (
            <p aria-hidden className="invisible text-sm lg:hidden">
              &nbsp;
            </p>
          )}
          {filter.some && chip.some && <FilterChip label={chip.val.fullName} onClear={filter.val.onClear} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {filter.some && <WeekFilter {...filter.val} />}
        <WeekNavigationControls navigation={navigation} />
        {onSchedule.some && (
          <Button
            size="sm"
            className="bg-brand px-4 text-[13px] hover:bg-brand/90"
            disabled={readOnly}
            onClick={onSchedule.val}
          >
            <Plus aria-hidden />
            Schedule session
          </Button>
        )}
      </div>
    </div>
  );
}

/** Phone only; beside a long title it wraps rather than push the arrows down. */
function BackToCurrentWeek({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="link"
      className="col-start-2 row-span-2 row-start-1 h-auto min-w-0 self-center justify-self-end whitespace-normal p-0 text-right text-[13px] leading-tight lg:hidden"
      onClick={onClick}
    >
      Back to current week
    </Button>
  );
}

const ARROW_CLASS = "[&_svg]:size-[15px]";

function WeekNavigationControls({ navigation }: { navigation: WeekNavigation }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon-sm"
        className={ARROW_CLASS}
        aria-label="Previous week"
        disabled={!navigation.canGoEarlier}
        onClick={navigation.onPrevious}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="hidden text-[13px] disabled:text-faint disabled:opacity-100 lg:inline-flex"
        disabled={navigation.isCurrentWeek}
        onClick={navigation.onThisWeek}
      >
        This week
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        className={ARROW_CLASS}
        aria-label="Next week"
        disabled={!navigation.canGoLater}
        onClick={navigation.onNext}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

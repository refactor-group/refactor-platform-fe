import { ChevronLeft, ChevronRight, House, Plus } from "lucide-react";
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
        <div className="flex flex-col gap-x-3 lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-y-3">
          <h2 id={titleId} className="text-section font-normal">
            {title}
          </h2>
          <span className="text-card-title tabular-nums text-ink-2">{range}</span>
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
      {/* Below lg one row of icons: filter, arrows, then a round Schedule at the far right. */}
      <div className="flex w-full items-center gap-2 lg:w-auto lg:flex-wrap lg:gap-4">
        {filter.some && <WeekFilter {...filter.val} />}
        <WeekNavigationControls navigation={navigation} />
        {onSchedule.some && (
          <Button
            size="sm"
            className="ml-auto w-9 bg-brand px-0 text-[13px] hover:bg-brand/90 lg:ml-0 lg:w-auto lg:px-4"
            disabled={readOnly}
            onClick={onSchedule.val}
          >
            <Plus aria-hidden />
            <span className="sr-only lg:not-sr-only">Schedule session</span>
          </Button>
        )}
      </div>
    </div>
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
        className={cn(ARROW_CLASS, "disabled:text-faint disabled:opacity-100 lg:hidden")}
        aria-label="Back to current week"
        disabled={navigation.isCurrentWeek}
        onClick={navigation.onThisWeek}
      >
        <House aria-hidden />
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

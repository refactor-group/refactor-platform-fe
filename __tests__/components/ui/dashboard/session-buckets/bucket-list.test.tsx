import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { BucketList } from "@/components/ui/dashboard/session-buckets/bucket-list";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import { CoachingSessionBuckets } from "@/lib/utils/session";
import { Some } from "@/types/option";

// BucketAccordion fetches sessions internally; gate it off by leaving
// every accordion collapsed (defaultExpandedKey=undefined). The hook
// short-circuits when userId is null in that branch, but we still
// stub it for safety.
vi.mock("@/lib/api/coaching-sessions", () => ({
  CoachingSessionInclude: { Relationship: "relationship", Goal: "goal" },
  useEnrichedCoachingSessionsForUser: () => ({
    enrichedSessions: [],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));

// SessionRow renders inside the (collapsed) accordion bodies; harmless
// here but vi.mock keeps clipboard / share-link helpers from running.
vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: vi.fn(),
}));

// Sun May 24 2026 — currentWeek = May 24 – May 30, so the May–Jun
// bucket (May 1 – Jun 30) is the overlap.
const ANCHOR = DateTime.fromISO("2026-05-24T12:00:00.000Z", { zone: "utc" });

function futureGrid() {
  // Returns: May-Jun (overlap), Jul-Aug, Sep-Oct.
  return CoachingSessionBuckets.generate(ANCHOR, 6, 0);
}

function pastGrid() {
  // Returns: May-Jun (overlap), Mar-Apr, Jan-Feb, Nov-Dec '25.
  return CoachingSessionBuckets.generate(ANCHOR, 0, 6);
}

function renderUpcoming(opts: {
  thisWeekCountInView: number;
  countsByKey?: Map<string, ReturnType<typeof Some>>;
}) {
  const buckets = futureGrid();
  const overlapKey = buckets.find((b) =>
    b.start.toFormat("yyyy-MM") === "2026-05"
  )!.key;
  const counts =
    opts.countsByKey ?? new Map([[overlapKey, Some(7)]]);
  render(
    <BucketList
      buckets={buckets}
      countsByKey={counts}
      thisWeekCountInView={opts.thisWeekCountInView}
      defaultExpandedKey={undefined}
      view={CoachingSessionBucketView.Upcoming}
      mountNow={ANCHOR}
      userId="user-1"
      relationshipId={undefined}
      viewerId="coach-1"
      userTimezone="UTC"
      selectedId={undefined}
      onSelect={vi.fn()}
      onReschedule={vi.fn()}
      onRequestDelete={vi.fn()}
      recentlyAddedKeys={new Set()}
      showMoreLabel="Show additional future sessions"
      onShowMore={vi.fn()}
      showMoreLoading={false}
      showMoreDisabled={true}
    />
  );
  return overlapKey;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BucketList — overlap bucket count adjustment", () => {
  it("subtracts thisWeekCountInView from the overlap bucket badge", () => {
    // BE month sum = 7, this-week sessions matching view = 3, so the
    // badge should read (4). Without the wiring, this assertion fails:
    // the badge would read (7).
    renderUpcoming({ thisWeekCountInView: 3 });
    expect(screen.getByText("(4)")).toBeInTheDocument();
    expect(screen.queryByText("(7)")).not.toBeInTheDocument();
  });

  it("drops the overlap bucket entirely when thisWeekCountInView matches the BE sum", () => {
    // Greptile's motivating case: every session in the overlap bucket
    // is in this week. Corrected count = 0 → existing Some(0) filter
    // drops the bucket → header never renders, no vanishing-after-click.
    renderUpcoming({ thisWeekCountInView: 7 });
    // Sibling Jul-Aug bucket has no count → still renders (None falls
    // through the empty filter), label shows the natural range.
    expect(screen.getByText(/Jul 1 – Aug 31/)).toBeInTheDocument();
    // Overlap clipped label "May 31 – Jun 30" should be gone.
    expect(screen.queryByText(/May 31 – Jun 30/)).not.toBeInTheDocument();
  });

  it("leaves non-overlap bucket badges untouched", () => {
    // Pass a non-zero count for the non-overlap Jul-Aug bucket. Even
    // with thisWeekCountInView=5, the Jul-Aug badge should still read
    // (10) — the adjustment is overlap-only.
    const buckets = futureGrid();
    const overlap = buckets.find((b) => b.start.toFormat("yyyy-MM") === "2026-05")!;
    const julAug = buckets.find((b) => b.start.toFormat("yyyy-MM") === "2026-07")!;
    const counts = new Map([
      [overlap.key, Some(7)],
      [julAug.key, Some(10)],
    ]);
    renderUpcoming({ thisWeekCountInView: 5, countsByKey: counts });
    expect(screen.getByText("(10)")).toBeInTheDocument();
  });
});

describe("BucketList — Previous view overlap adjustment", () => {
  it("subtracts thisWeekCountInView from the Previous overlap bucket", () => {
    const buckets = pastGrid();
    const overlap = buckets.find((b) => b.start.toFormat("yyyy-MM") === "2026-05")!;
    const counts = new Map([[overlap.key, Some(6)]]);
    render(
      <BucketList
        buckets={buckets}
        countsByKey={counts}
        thisWeekCountInView={2}
        defaultExpandedKey={undefined}
        view={CoachingSessionBucketView.Previous}
        mountNow={ANCHOR}
        userId="user-1"
        relationshipId={undefined}
        viewerId="coach-1"
        userTimezone="UTC"
        selectedId={undefined}
        onSelect={vi.fn()}
        onReschedule={vi.fn()}
        onRequestDelete={vi.fn()}
        recentlyAddedKeys={new Set()}
        showMoreLabel="Show additional past sessions"
        onShowMore={vi.fn()}
        showMoreLoading={false}
        showMoreDisabled={true}
      />
    );
    // 6 - 2 = 4.
    expect(screen.getByText("(4)")).toBeInTheDocument();
  });
});

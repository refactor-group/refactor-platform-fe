"use client";

import { useState } from "react";
import type { DateTime } from "ts-luxon";
import { MODAL_DESKTOP_QUERY } from "@/lib/breakpoints";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { DEFAULT_REPEAT_COUNT, type RepeatPrefill, useDialogRecurrence } from "@/lib/hooks/use-dialog-recurrence";
import { type SeriesLoad, useScheduleData, useScheduleTimezone } from "@/lib/hooks/use-schedule-data";
import { type SessionPlan, useScheduleSubmit } from "@/lib/hooks/use-schedule-submit";
import {
  followingMoveCount,
  moveChanged,
  moveHint,
  movePerson,
  moveRail,
  seriesRepeatFrom,
  startMoved,
} from "@/lib/move-draft";
import type { PersonEntry } from "@/lib/people";
import {
  type NewSessionDialogModel,
  type ResolveDraft,
  UNRESOLVED,
  createsCount,
  draftFor,
  entryFor,
  initialDraft,
  leadFor,
  moverOf,
  peopleEntries,
  repeatChoice,
  resolveModel,
  seriesCadenceOf,
  startAt,
  summaryOf,
  usualOf,
  whoState,
} from "@/lib/new-session-dialog-model";
import { clashFor, prefillWhen, scheduleHint, scheduleRail } from "@/lib/schedule-draft";
import { seriesSlotStart } from "@/lib/session-window";
import {
  DEFAULT_WORKING_HOURS,
  MoveScope,
  type StepKind,
  busyOn,
  currentStep,
  nextStep,
  prevStep,
  stepOrder,
  stepPosition,
  suggestTimes,
} from "@/lib/scheduling";
import { followingMoveLine, moveSubmitLabel, scheduleSubmitLabel, seriesRuleLine } from "@/lib/scheduling-copy";
import type { NewSessionRequest } from "@/lib/stores/new-session-dialog-store";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { CoachingSessionSeriesWithSessions } from "@/types/coaching-session-series";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { validateRecurrence, weekdayFromLuxon } from "@/types/recurrence";

const DEFAULT_UNTIL_WEEKS = 8;

function untilAfter(start: DateTime): string {
  return start.plus({ weeks: DEFAULT_UNTIL_WEEKS }).toFormat("yyyy-MM-dd");
}

function repeatPrefill(
  moving: Option<EnrichedCoachingSession>,
  series: Option<CoachingSessionSeriesWithSessions>,
  timezone: string
): Option<RepeatPrefill> {
  if (moving.none || series.none) return None;
  const slot = seriesSlotStart(moving.val, timezone);
  return Some({ repeat: seriesRepeatFrom(series.val, moving.val), weekday: weekdayFromLuxon(slot.weekday) });
}

const SERIES_FAILED_LINE = "Couldn't load the series, so only this session can change.";

/** `seriesLoad` is the moved session's series; none for a one-off. */
export function useNewSessionDialog(
  request: NewSessionRequest,
  seriesLoad: SeriesLoad,
  onClose: () => void
): NewSessionDialogModel {
  const series = seriesLoad.kind === "loaded" ? Some(seriesLoad.series) : None;
  const seriesFailed = seriesLoad.kind === "error";
  const desktop = useMediaQuery(MODAL_DESKTOP_QUERY);
  const zone = useScheduleTimezone();
  const [initial] = useState(() => initialDraft(request, zone));
  const moving = request.kind === "move" ? Some(request.session) : None;
  const [personId, setPersonId] = useState<Option<Id>>(None);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [time, setTime] = useState(initial.time);
  const [whenTouched, setWhenTouched] = useState(initial.whenTouched);
  const [chosenMinutes, setChosenMinutes] = useState(initial.minutes);
  const [step, setStep] = useState<StepKind>(initial.step);
  const [repeating, setRepeating] = useState(false);
  const [savedResolve, setSavedResolve] = useState<Option<ResolveDraft>>(None);
  const [scope, setScope] = useState(request.kind === "move" ? request.scope : MoveScope.This);
  const inSeries = moving.some && moving.val.coaching_session_series_id.some;
  // A series that couldn't load can only have this session moved.
  const effectiveScope = seriesFailed ? MoveScope.This : scope;
  const following = inSeries && effectiveScope === MoveScope.Following;
  const repeatOn = moving.some ? following : repeating;

  const data = useScheduleData({ month, selected: day });
  const { now, timezone } = data;
  // The session being moved never counts as busy.
  const busy = moving.some ? data.busy.filter((b) => b.id !== moving.val.id) : data.busy;
  const { submitting, submit } = useScheduleSubmit(onClose);
  const minutes = chosenMinutes.some ? chosenMinutes.val : data.defaultMinutes;
  const start = startAt(day, time);
  const startWeekday = day.some ? weekdayFromLuxon(day.val.weekday) : null;
  const prefill = repeatPrefill(moving, series, zone);
  const recurrence = useDialogRecurrence({
    enabled: repeatOn,
    startWeekday,
    timezone,
    prefill,
  });
  const cadence = { frequency: recurrence.frequency, interval: recurrence.interval };
  const repeat = repeatChoice(repeatOn, cadence, recurrence.end);
  const recurrenceError = repeatOn
    ? validateRecurrence({
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        byWeekdays: recurrence.byWeekdays,
        end: recurrence.end,
        start: start.some ? start.val : null,
        startWeekday,
        timezone,
      })
    : null;
  const error: Option<string> = recurrenceError ? Some(recurrenceError) : None;

  const entry = moving.some ? movePerson(moving.val, data.userId, peopleEntries(data)) : entryFor(data, personId);
  const personName = entry.some ? Some(entry.val.person.fullName) : None;
  const changed = moving.some && moveChanged(moving.val, { start, minutes }, timezone);
  // Only the first session of a series is checked.
  const clash = start.some ? clashFor({ start: start.val, minutes }, busy, DEFAULT_WORKING_HOURS) : None;
  const clashSession = clash.some ? Some(clash.val.session) : None;
  const resolveDraft = start.some ? draftFor(clash, { start: start.val, minutes }, savedResolve) : None;
  const resolution = resolveDraft.some ? resolveDraft.val.resolution : UNRESOLVED;
  const other = clash.some ? data.busySource.find((s) => s.id === clash.val.session.id) : undefined;
  // Moving one of several overlapped sessions wouldn't clear the time, so several can only be kept.
  const several = clash.some && clash.val.others.length > 0;
  const movable = !several && other !== undefined && other.relationship?.coach_id === data.userId;
  const overlap = { clash: clashSession, keepOnly: !movable, several, resolution };

  const order = stepOrder(moving.some ? { kind: "move", appliesTo: inSeries, following } : { kind: "schedule" }, clash.some);
  const current = currentStep(order, step);
  const next = nextStep(order, current);
  const prev = prevStep(order, current);

  const planFor = ({ person, relationshipIds }: PersonEntry, at: DateTime): SessionPlan => {
    const moveOther =
      clash.some && other && resolution.kind === "move"
        ? Some({ session: other, personName: clash.val.session.personName, start: resolution.start })
        : None;
    if (moving.some) {
      const moved = {
        session: moving.val,
        personName: person.fullName,
        start: at,
        startMoved: startMoved(moving.val, at, timezone),
        minutes,
        moveOther,
      };
      const seriesId = moving.val.coaching_session_series_id;
      if (!following || seriesId.none || repeat.kind !== "repeat") return { kind: "move", ...moved };
      const { frequency, interval, end } = repeat;
      return {
        kind: "following",
        ...moved,
        seriesId: seriesId.val,
        frequency,
        interval,
        end,
        byWeekdays: recurrence.byWeekdays,
        timezone,
      };
    }
    return {
      kind: "schedule",
      relationshipId: relationshipIds[0],
      personName: person.fullName,
      start: at,
      minutes,
      provider: data.provider,
      repeat,
      byWeekdays: recurrence.byWeekdays,
      timezone,
      moveOther,
    };
  };

  const moveCount =
    moving.some && following && series.some && prefill.some && start.some && repeat.kind === "repeat"
      ? followingMoveCount({
          anchor: moving.val,
          sessions: series.val.coaching_sessions,
          start: start.val,
          slots: createsCount(repeat, start, recurrence.byWeekdays),
          rule: { ...cadence, byWeekdays: recurrence.byWeekdays, current: prefill.val.repeat },
          timezone,
        })
      : 0;
  const moves: Option<string> =
    start.some && moveCount > 0
      ? Some(followingMoveLine(moveCount, cadence, recurrence.byWeekdays, start.val))
      : None;

  const confirm = () => {
    if (entry.none || start.none) return;
    submit(planFor(entry.val, start.val));
  };

  const selectPerson = (userId: Id) => {
    setPersonId(Some(userId));
    if (whenTouched || request.kind !== "schedule") return;
    const usual = usualOf(data, entryFor(data, Some(userId)));
    const when = prefillWhen({ requested: request.date, usual, busy, minutes, now });
    setDay(when.day);
    setTime(when.time);
    if (when.day.some) setMonth(Some(when.day.val.startOf("month")));
  };

  return {
    title: moving.some ? "Reschedule session" : "New session",
    mover: moving.some && entry.some ? Some(moverOf(entry.val, moving.val, timezone)) : None,
    step: current,
    rail: moving.some
      ? moveRail({ order, step, start, changed, scope: effectiveScope, repeat, ...overlap })
      : scheduleRail({ order, step, personName, start, repeat, ...overlap }),
    position: stepPosition(order, step),
    onPrev: prev.some ? Some(() => setStep(prev.val)) : None,
    onNext: next.some ? Some(() => setStep(next.val)) : None,
    lead: leadFor({
      last: next.none,
      hint: moving.some
        ? moveHint({
            changed,
            following,
            seriesLoading: seriesLoad.kind === "loading",
            availability: data.availability,
            ...overlap,
          })
        : scheduleHint({ personName, start, availability: data.availability, ...overlap }),
      label: moving.some ? moveSubmitLabel(following) : scheduleSubmitLabel(repeat),
      error,
      submitting,
      onConfirm: confirm,
    }),
    summary:
      entry.some && moving.none
        ? Some(summaryOf(entry.val, createsCount(repeat, start, recurrence.byWeekdays), data.provider))
        : None,
    moves,
    who: { state: whoState(data), selectedId: personId, onSelect: selectPerson },
    appliesTo: {
      scope: effectiveScope,
      subline: seriesFailed
        ? Some(SERIES_FAILED_LINE)
        : series.some && personName.some
          ? Some(seriesRuleLine(personName.val, series.val.rule.recurrence))
          : None,
      followingAvailable: !seriesFailed,
      onScopeChange: setScope,
    },
    when: {
      month: data.month,
      today: now,
      day,
      busy,
      dayBusy: day.some ? busyOn(busy, day.val, None) : [],
      clash,
      suggestions: day.some
        ? suggestTimes({
            day: day.val,
            minutes,
            usual: usualOf(data, entry),
            coachStarts: data.coachStarts,
            busy,
            hours: DEFAULT_WORKING_HOURS,
            now,
          })
        : [],
      time,
      minutes,
      tooltips: desktop,
      onSelectDay: (picked) => {
        setWhenTouched(true);
        setDay(Some(picked));
      },
      onMonthChange: (shown) => setMonth(Some(shown)),
      onTimeChange: (value) => {
        setWhenTouched(true);
        setTime(Some(value));
      },
      onMinutesChange: (value) => setChosenMinutes(Some(value)),
    },
    repeat: {
      repeat,
      optional: moving.none,
      locked: following && seriesLoad.kind === "loading",
      byWeekdays: recurrence.byWeekdays,
      lockedWeekday: startWeekday ?? weekdayFromLuxon(now.weekday),
      defaultEnd: { count: DEFAULT_REPEAT_COUNT, until: untilAfter(start.some ? start.val : now) },
      seriesCadence: seriesCadenceOf(prefill.some ? Some(prefill.val.repeat) : None),
      error,
      onRepeatChange: (choice) => {
        setRepeating(choice.some);
        if (choice.some) recurrence.setCadence(choice.val);
      },
      onWeekdaysChange: recurrence.setByWeekdays,
      onEndChange: recurrence.setEnd,
    },
    resolve:
      clash.some && start.some && resolveDraft.some
        ? Some(
            resolveModel({
              clash: clash.val,
              start: start.val,
              minutes,
              movable,
              draft: resolveDraft.val,
              busy,
              now,
              onChange: (draft) => setSavedResolve(Some(draft)),
            })
          )
        : None,
  };
}

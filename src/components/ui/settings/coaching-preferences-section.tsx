"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUser, useUserMutation } from "@/lib/api/users";
import {
  FieldSet,
  FieldGroup,
  FieldLegend,
  FieldDescription,
  Field,
  FieldLabel,
  FieldContent,
  FieldTitle,
  FieldError,
} from "@/components/kibo/ui/field";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";
import {
  FALLBACK_DURATION_MINUTES,
  isDurationValidationError,
  validateDurationMinutes,
} from "@/types/coaching-session-duration";
import {
  isForbiddenError,
  PERMISSION_DENIED_MESSAGE,
} from "@/types/entity-api-error";
import { type Option, None, Some } from "@/types/option";
import type { User } from "@/types/user";
import { clockLabel, formatClock, halfHourClocks, parseClock, workingHoursOf } from "@/lib/working-hours";

const AUTOSAVE_DEBOUNCE_MS = 400;

type Preferences = Pick<
  User,
  "default_coaching_session_duration_minutes" | "working_hours_start" | "working_hours_end"
>;

function savedPreferences(user: User | undefined): Preferences {
  const hours = workingHoursOf(user ? Some(user) : None);
  return {
    default_coaching_session_duration_minutes:
      user?.default_coaching_session_duration_minutes ?? FALLBACK_DURATION_MINUTES,
    working_hours_start: formatClock(hours.start),
    working_hours_end: formatClock(hours.end),
  };
}

function hoursChanged(a: Preferences, b: Preferences): boolean {
  return a.working_hours_start !== b.working_hours_start || a.working_hours_end !== b.working_hours_end;
}

function samePreferences(a: Preferences, b: Preferences): boolean {
  return (
    a.default_coaching_session_duration_minutes === b.default_coaching_session_duration_minutes && !hoursChanged(a, b)
  );
}

function startsBeforeEnd(prefs: Preferences): boolean {
  const start = parseClock(prefs.working_hours_start);
  const end = parseClock(prefs.working_hours_end);
  return start.some && end.some && start.val < end.val;
}

function saveErrorMessage(error: unknown, hours: boolean): string {
  if (isForbiddenError(error)) return PERMISSION_DENIED_MESSAGE;
  if (isDurationValidationError(error)) {
    return hours
      ? "Those hours didn't save · Start must be before end"
      : "That length isn't allowed · Pick a different duration";
  }
  return "Couldn't save your preferences · Try again";
}

const CLOCKS = halfHourClocks();

interface ClockSelectProps {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const ClockSelect: FC<ClockSelectProps> = ({ id, label, value, disabled, onChange }) => (
  <select
    id={id}
    aria-label={label}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className="flex h-10 w-full rounded-input border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
  >
    {CLOCKS.map((m) => (
      <option key={m} value={formatClock(m)}>
        {clockLabel(m)}
      </option>
    ))}
  </select>
);

export const CoachingPreferencesSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { user, isLoading, refresh } = useUser(userId);
  const { update, isLoading: isSaving } = useUserMutation();

  const saved = useMemo(() => savedPreferences(user), [user]);
  const [draft, setDraft] = useState<Preferences>(saved);
  // A server that drops a field leaves the draft dirty, so a sent draft waits for the next edit.
  const sent = useRef<Option<Preferences>>(None);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const durationMinutes = draft.default_coaching_session_duration_minutes;
  const durationValidation = validateDurationMinutes(durationMinutes);
  const durationDirty = durationMinutes !== saved.default_coaching_session_duration_minutes;
  const hoursDirty = hoursChanged(draft, saved);
  const hoursValid = startsBeforeEnd(draft);
  const isDirty = durationDirty || hoursDirty;
  const isValid = durationValidation.isOk() && hoursValid;
  const edit = (patch: Partial<Preferences>) => setDraft((prev) => ({ ...prev, ...patch }));

  // Debounced so rapid edits coalesce into one PUT; `isSaving` stops a second
  // PUT when `update`'s identity changes mid-request and reruns the effect.
  useEffect(() => {
    if (!user || !isDirty || !isValid || isSaving) return;
    if (sent.current.some && samePreferences(sent.current.val, draft)) return;
    const timer = setTimeout(() => {
      sent.current = Some(draft);
      void (async () => {
        try {
          await update(userId, { ...user, ...draft });
          refresh();
        } catch (error) {
          toast.error(saveErrorMessage(error, hoursDirty));
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, hoursDirty, isDirty, isValid, isSaving, user, userId, update, refresh]);

  if (!isACoach) {
    return null;
  }

  return (
    <FieldSet>
      <FieldGroup>
        <FieldLegend>Default Coaching Session Duration</FieldLegend>
        <FieldDescription>
          Pre-fills the duration when you schedule a new coaching session.
          You can override the duration for any individual session.
        </FieldDescription>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="default-duration">Default duration</FieldLabel>
          <FieldContent>
            <CoachingSessionDurationInput
              id="default-duration"
              value={durationMinutes}
              onChange={(minutes) =>
                edit({ default_coaching_session_duration_minutes: minutes })
              }
              disabled={isLoading}
              error={
                durationDirty
                  ? durationValidation.match(() => undefined, (msg) => msg)
                  : undefined
              }
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <FieldTitle className="text-base">Working hours</FieldTitle>
        <FieldDescription>
          Sets the time slots you can move sessions into, and when the
          scheduler warns that a time is outside your day.
        </FieldDescription>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="working-hours-start">Start</FieldLabel>
          <FieldContent>
            <ClockSelect
              id="working-hours-start"
              label="Working hours start"
              value={draft.working_hours_start}
              disabled={isLoading}
              onChange={(value) => edit({ working_hours_start: value })}
            />
          </FieldContent>
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="working-hours-end">End</FieldLabel>
          <FieldContent>
            <ClockSelect
              id="working-hours-end"
              label="Working hours end"
              value={draft.working_hours_end}
              disabled={isLoading}
              onChange={(value) => edit({ working_hours_end: value })}
            />
          </FieldContent>
        </Field>

        {!hoursValid && <FieldError>Start must be before end.</FieldError>}
      </FieldGroup>
    </FieldSet>
  );
};

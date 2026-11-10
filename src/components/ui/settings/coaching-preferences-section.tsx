"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUser, useUserPreferencesMutation } from "@/lib/api/users";
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
import { None, Some } from "@/types/option";
import type { User, UserPreferencesUpdate } from "@/types/user";
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

function startsBeforeEnd(prefs: Preferences): boolean {
  const start = parseClock(prefs.working_hours_start);
  const end = parseClock(prefs.working_hours_end);
  return start.some && end.some && start.val < end.val;
}

// The duration if it changed, and both hours together if either did.
function changedPreferences(shown: Preferences, saved: Preferences): UserPreferencesUpdate {
  const duration = shown.default_coaching_session_duration_minutes;
  return {
    ...(duration !== saved.default_coaching_session_duration_minutes
      ? { default_coaching_session_duration_minutes: duration }
      : {}),
    ...(hoursChanged(shown, saved)
      ? { working_hours_start: shown.working_hours_start, working_hours_end: shown.working_hours_end }
      : {}),
  };
}

// Drops the edits a save sent, keeping any made while it was in flight.
function withoutSent(edits: UserPreferencesUpdate, sent: UserPreferencesUpdate): UserPreferencesUpdate {
  const kept = { ...edits };
  for (const key of Object.keys(sent) as (keyof UserPreferencesUpdate)[]) {
    if (kept[key] === sent[key]) delete kept[key];
  }
  return kept;
}

// The backend answers a bad duration and bad hours with the same 422, so
// only a save of one field can name it.
function saveErrorMessage(error: unknown, sent: UserPreferencesUpdate): string {
  if (isForbiddenError(error)) return PERMISSION_DENIED_MESSAGE;
  if (isDurationValidationError(error)) {
    const duration = "default_coaching_session_duration_minutes" in sent;
    const hours = "working_hours_start" in sent;
    if (duration && hours) return "Your preferences didn't save · Check the duration and hours";
    return hours
      ? "Those hours didn't save · Start must be before end"
      : "That length isn't allowed · Pick a different duration";
  }
  return "Couldn't save your preferences · Try again";
}

const CLOCKS = halfHourClocks();
// Labels differ in length, so a fixed width keeps the controls lined up.
const CONTROL_WIDTH = "w-36 flex-none sm:w-72";

interface ClockSelectProps {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const ClockSelect: FC<ClockSelectProps> = ({ id, label, value, disabled, onChange }) => (
  <div className="relative">
    <select
      id={id}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full appearance-none rounded-input border border-input bg-background py-2 pl-3 pr-9 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
    >
      {CLOCKS.map((m) => (
        <option key={m} value={formatClock(m)}>
          {clockLabel(m)}
        </option>
      ))}
    </select>
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    />
  </div>
);

export const CoachingPreferencesSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { user, isLoading, refresh } = useUser(userId);
  const { update, isLoading: isSaving } = useUserPreferencesMutation();

  const saved = useMemo(() => savedPreferences(user), [user]);
  // Only the unsaved edits, so a re-read user still shows through untouched fields.
  const [edits, setEdits] = useState<UserPreferencesUpdate>({});
  const shown = useMemo<Preferences>(() => ({ ...saved, ...edits }), [saved, edits]);
  const changes = useMemo(() => changedPreferences(shown, saved), [shown, saved]);

  const durationMinutes = shown.default_coaching_session_duration_minutes;
  const durationValidation = validateDurationMinutes(durationMinutes);
  const durationDirty = "default_coaching_session_duration_minutes" in changes;
  const hoursValid = startsBeforeEnd(shown);
  const isDirty = Object.keys(changes).length > 0;
  const isValid = durationValidation.isOk() && hoursValid;
  const edit = (patch: UserPreferencesUpdate) => setEdits((prev) => ({ ...prev, ...patch }));

  // Debounced so rapid edits coalesce into one PUT; `isSaving` stops a second
  // PUT when `update`'s identity changes mid-request and reruns the effect.
  useEffect(() => {
    if (!user || !isDirty || !isValid || isSaving) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await update(userId, changes);
          await refresh();
          setEdits((prev) => withoutSent(prev, changes));
        } catch (error) {
          toast.error(saveErrorMessage(error, changes));
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [changes, isDirty, isValid, isSaving, user, userId, update, refresh]);

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
          <FieldContent className={CONTROL_WIDTH}>
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
          <FieldContent className={CONTROL_WIDTH}>
            <ClockSelect
              id="working-hours-start"
              label="Working hours start"
              value={shown.working_hours_start}
              disabled={isLoading}
              onChange={(value) => edit({ working_hours_start: value })}
            />
          </FieldContent>
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="working-hours-end">End</FieldLabel>
          <FieldContent className={CONTROL_WIDTH}>
            <ClockSelect
              id="working-hours-end"
              label="Working hours end"
              value={shown.working_hours_end}
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

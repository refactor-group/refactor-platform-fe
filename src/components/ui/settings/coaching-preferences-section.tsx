"use client";

import * as React from "react";
import type { FC } from "react";
import { toast } from "sonner";
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
} from "@/components/kibo/ui/field";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";
import {
  FALLBACK_DURATION_MINUTES,
  isDurationValidationError,
  validateDurationMinutes,
} from "@/types/coaching-session-duration";

const AUTOSAVE_DEBOUNCE_MS = 400;

export const CoachingPreferencesSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { user, isLoading, refresh } = useUser(userId);
  const { update } = useUserMutation();

  const savedValue =
    user?.default_coaching_session_duration_minutes ?? FALLBACK_DURATION_MINUTES;
  const [durationMinutes, setDurationMinutes] =
    React.useState<number>(savedValue);

  React.useEffect(() => {
    setDurationMinutes(savedValue);
  }, [savedValue]);

  const validationError = validateDurationMinutes(durationMinutes);
  const isDirty = durationMinutes !== savedValue;

  // Auto-save on value change, debounced so rapid edits (e.g. per-keystroke
  // onChange from the custom numeric input) coalesce into a single PUT.
  React.useEffect(() => {
    if (!user || !isDirty || validationError !== null) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await update(userId, {
            ...user,
            default_coaching_session_duration_minutes: durationMinutes,
          });
          refresh();
        } catch (error) {
          if (isDurationValidationError(error)) {
            toast.error(
              (error.data as { message?: string }).message ??
                "Invalid duration."
            );
          } else {
            toast.error("Couldn't save preferences. Please try again.");
          }
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    durationMinutes,
    isDirty,
    validationError,
    user,
    userId,
    update,
    refresh,
  ]);

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
              onChange={setDurationMinutes}
              disabled={isLoading}
              error={isDirty ? validationError : null}
            />
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
};

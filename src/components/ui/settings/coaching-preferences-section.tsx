"use client";

import { useEffect, useState } from "react";
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
import {
  isForbiddenError,
  PERMISSION_DENIED_MESSAGE,
} from "@/types/entity-api-error";

const AUTOSAVE_DEBOUNCE_MS = 400;

export const CoachingPreferencesSection: FC = () => {
  const { isACoach, userId } = useAuthStore((state) => state);
  const { user, isLoading, refresh } = useUser(userId);
  const { update, isLoading: isSaving } = useUserMutation();

  const savedValue =
    user?.default_coaching_session_duration_minutes ?? FALLBACK_DURATION_MINUTES;
  const [durationMinutes, setDurationMinutes] =
    useState<number>(savedValue);

  useEffect(() => {
    setDurationMinutes(savedValue);
  }, [savedValue]);

  const durationValidation = validateDurationMinutes(durationMinutes);
  const isDirty = durationMinutes !== savedValue;
  const isValid = durationValidation.isOk();

  // Auto-save on value change, debounced so rapid edits (e.g. per-keystroke
  // onChange from the custom numeric input) coalesce into a single PUT.
  // `isSaving` gates re-entry so an in-flight save doesn't trigger a second
  // PUT when `update`'s identity changes mid-request and reruns the effect.
  useEffect(() => {
    if (!user || !isDirty || !isValid || isSaving) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await update(userId, {
            ...user,
            default_coaching_session_duration_minutes: durationMinutes,
          });
          refresh();
        } catch (error) {
          if (isForbiddenError(error)) {
            toast.error(PERMISSION_DENIED_MESSAGE);
          } else if (isDurationValidationError(error)) {
            toast.error(error.data.message);
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
    isValid,
    isSaving,
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
              error={
                isDirty
                  ? durationValidation.match(() => undefined, (msg) => msg)
                  : undefined
              }
            />
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
};

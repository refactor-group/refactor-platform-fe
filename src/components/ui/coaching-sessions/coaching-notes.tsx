"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { TipTapEditor } from "@/components/ui/coaching-sessions/tiptap-editor";

export interface EditorRef {
  setContent: (content: string) => void;
  setFocussed: () => void;
}

interface CoachingNotesProps {
  value: string;
  onChange: (content: string) => void;
  onSynced?: () => void;
  onKeyDown: () => void;
}

const CoachingNotes = forwardRef<EditorRef, CoachingNotesProps>(
  ({ value, onChange, onSynced, onKeyDown }, ref) => {
    const WAIT_INTERVAL = 1000;
    const timerRef = useRef<number | undefined>(undefined);
    const [note, setNote] = useState<string>(value);

    useEffect(() => {
      setNote(value);
    }, [value]);

    const handleSessionNoteChange = useCallback(
      (newValue: string) => {
        onKeyDown();
        setNote(newValue);

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = window.setTimeout(() => {
          console.debug(
            "Calling onChange() from CoachingNotes::handleSessionNoteChange() timer"
          );
          onChange(newValue);
        }, WAIT_INTERVAL);
      },
      [onKeyDown, onChange, WAIT_INTERVAL]
    );

    const handleSessionNoteSynced = useCallback(() => {
      if (onSynced) {
        onSynced();
      }
    }, [onSynced]);

    useEffect(() => {
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);

    return (
      <TipTapEditor
        ref={ref}
        editorContent={note}
        onChange={handleSessionNoteChange}
        onSynced={handleSessionNoteSynced}
      />
    );
  }
);

CoachingNotes.displayName = "CoachingNotes";

export { CoachingNotes };

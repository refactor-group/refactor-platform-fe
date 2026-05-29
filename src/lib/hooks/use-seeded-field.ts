import { useEffect, useRef } from "react";
import type { Option } from "@/types/option";
import type { NoteField } from "@/types/note-selection";

/**
 * Applies a {@link NoteField}'s text once per distinct nonce. The caller's
 * `apply` closure owns the append-vs-replace policy; this hook only handles
 * the nonce dedup so the same selection is never applied twice.
 */
export function useSeededField(
  field: Option<NoteField>,
  apply: (text: string) => void
): void {
  const lastNonce = useRef(0);
  // Keep the latest closure without re-firing the seed effect on its identity.
  // Declared before the seed effect so it commits first on every render.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    if (!field.some || field.val.nonce === lastNonce.current) return;
    lastNonce.current = field.val.nonce;
    applyRef.current(field.val.text);
  }, [field]);
}

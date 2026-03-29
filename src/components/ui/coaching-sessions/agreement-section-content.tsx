"use client";

import { useMemo } from "react";
import { CompactAgreementCard } from "@/components/ui/coaching-sessions/agreement-card-compact";
import { defaultAgreement } from "@/types/agreement";
import type { Agreement } from "@/types/agreement";

export interface AgreementSectionContentProps {
  agreements: Agreement[];
  locale: string;
  isAddingAgreement: boolean;
  onAddingAgreementChange: (adding: boolean) => void;
  onAgreementCreate?: (body: string) => Promise<void>;
  onAgreementEdit?: (id: string, body: string) => Promise<void>;
  onAgreementDelete?: (id: string) => void;
  readOnly?: boolean;
}

export function AgreementSectionContent({
  agreements,
  locale,
  isAddingAgreement,
  onAddingAgreementChange,
  onAgreementCreate,
  onAgreementEdit,
  onAgreementDelete,
  readOnly = false,
}: AgreementSectionContentProps) {
  // Lazy-init placeholder so defaultAgreement() isn't called at module scope
  // (avoids DateTime.now() running at import time during SSR)
  const newAgreementPlaceholder = useMemo(() => defaultAgreement(), []);

  return (
    <div className="space-y-3">
      {isAddingAgreement && onAgreementCreate && (
        <CompactAgreementCard
          agreement={newAgreementPlaceholder}
          locale={locale}
          initialEditing
          onSave={onAgreementCreate}
          onDismiss={() => onAddingAgreementChange(false)}
        />
      )}
      {agreements.length === 0 && !isAddingAgreement ? (
        <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
          <p className="text-sm text-muted-foreground/50 italic">
            No agreements yet
          </p>
        </div>
      ) : (
        agreements.map((agreement) => (
          <CompactAgreementCard
            key={agreement.id}
            agreement={agreement}
            locale={locale}
            onSave={readOnly ? undefined : onAgreementEdit
              ? (body) => onAgreementEdit(agreement.id, body)
              : undefined}
            onDelete={readOnly ? undefined : onAgreementDelete}
          />
        ))
      )}
    </div>
  );
}

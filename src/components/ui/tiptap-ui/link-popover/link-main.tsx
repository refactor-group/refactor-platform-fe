import * as React from "react";

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/ui/tiptap-icons/corner-down-left-icon";
import { ExternalLinkIcon } from "@/components/ui/tiptap-icons/external-link-icon";
import { TrashIcon } from "@/components/ui/tiptap-icons/trash-icon";

// --- Lib ---
import { sanitizeUrl } from "@/lib/tiptap-utils";

// --- UI Primitives ---
import { Button } from "@/components/ui/tiptap-ui-primitive/button";
import { Separator } from "@/components/ui/tiptap-ui-primitive/separator";

export interface LinkMainProps {
  url: string;
  setUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setLink: () => void;
  removeLink: () => void;
  isActive: boolean;
}

export const LinkMain: React.FC<LinkMainProps> = ({
  url,
  setUrl,
  setLink,
  removeLink,
  isActive,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setLink();
    }
  };

  const handleOpenLink = () => {
    if (!url) return;

    const safeUrl = sanitizeUrl(url, window.location.href);
    if (safeUrl !== "#") {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <input
        type="url"
        placeholder="Paste a link..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="tiptap-input tiptap-input-clamp"
      />

      <div className="tiptap-button-group" data-orientation="horizontal">
        <Button
          type="button"
          onClick={setLink}
          title="Apply link"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <CornerDownLeftIcon className="tiptap-button-icon" />
        </Button>

        <Separator orientation="vertical" />

        <Button
          type="button"
          onClick={handleOpenLink}
          title="Open in new window"
          disabled={!url}
          data-style="ghost"
        >
          <ExternalLinkIcon className="tiptap-button-icon" />
        </Button>

        <Button
          type="button"
          onClick={removeLink}
          title="Remove link"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <TrashIcon className="tiptap-button-icon" />
        </Button>
      </div>
    </>
  );
};

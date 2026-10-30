import { splitSnippet } from "@/types/search";

interface SearchSnippetProps {
  snippet: string;
  className?: string;
}

/** Renders a backend snippet's `<mark>` markers as text nodes, never as HTML. */
export function SearchSnippet({ snippet, className }: SearchSnippetProps) {
  return (
    <span className={className}>
      {splitSnippet(snippet).map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={index}
            className="rounded-[3px] px-0.5 font-medium bg-yellow-200 text-black dark:bg-yellow-500/40 dark:text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </span>
  );
}

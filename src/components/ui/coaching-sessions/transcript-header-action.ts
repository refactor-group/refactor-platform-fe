/**
 * Shared styling for the Transcript panel header's icon actions.
 *
 * Lives in its own module so the download button and the panel's own
 * `IconButton` cannot drift apart the next time the header restyles. A plain
 * constant rather than a shared component: the download button needs its own
 * disabled treatment and a spinner, so only the base class is common.
 */
export const TRANSCRIPT_HEADER_ACTION_CLASS =
  "hidden md:inline-flex h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground";

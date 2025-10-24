/**
 * Shared constants for coaching notes editor components
 */

/** Height of the toolbar in pixels (min-height 44px + padding 8px) */
export const TOOLBAR_HEIGHT_PX = 52;

/**
 * Threshold percentage for showing floating toolbar (0.0 to 1.0)
 * At 0.75, floating toolbar appears when 75% of simple toolbar is hidden
 */
export const TOOLBAR_SHOW_THRESHOLD = 0.95;

/**
 * Threshold percentage for hiding floating toolbar (0.0 to 1.0)
 * At 0.25, floating toolbar disappears when only 25% of simple toolbar is hidden (75% visible)
 * The difference between show/hide thresholds creates hysteresis to prevent rapid toggling
 */
export const TOOLBAR_HIDE_THRESHOLD = 0.25;

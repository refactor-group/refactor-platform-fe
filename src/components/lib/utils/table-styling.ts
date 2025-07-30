import { cn } from "@/components/lib/utils";

/**
 * Generates consistent table row classes with alternating colors, hover effects, and transitions
 * @param index - Row index for alternating colors
 * @param additionalClasses - Optional additional classes to apply
 * @returns Combined class string
 */
export const getTableRowClasses = (index: number, additionalClasses?: string) =>
  cn(
    // Base alternating colors
    index % 2 === 0
      ? "bg-white dark:bg-gray-900"
      : "bg-gray-50 dark:bg-gray-800",
    // Hover states that work with both backgrounds
    "hover:bg-blue-50 dark:hover:bg-gray-700",
    // Smooth transitions with reduced motion support
    "transition-colors duration-150 motion-reduce:transition-none",
    additionalClasses
  );

/**
 * Generates classes for completed action/agreement styling
 * @returns Class string for completed items
 */
export const getCompletedItemClasses = () => "text-gray-400";

/**
 * Generates consistent table header row classes
 * @returns Class string for table header rows
 */
export const getTableHeaderRowClasses = () => "bg-gray-50 dark:bg-gray-800/50";

/**
 * Generates consistent table header cell classes for sortable columns
 * @param isFirstColumn - Whether this is the first column (for rounded corners)
 * @param isLastColumn - Whether this is the last column (for rounded corners)
 * @returns Class string for sortable table header cells
 */
export const getTableHeaderCellClasses = (
  isFirstColumn = false,
  isLastColumn = false
) =>
  cn(
    "cursor-pointer font-semibold text-gray-700 dark:text-gray-300 py-3 px-4",
    "hover:text-gray-900 dark:hover:text-gray-100",
    "transition-colors duration-150 motion-reduce:transition-none",
    isFirstColumn && "rounded-tl-lg",
    isLastColumn && "rounded-tr-lg"
  );

/**
 * Generates consistent table header cell classes for non-sortable columns
 * @param isFirstColumn - Whether this is the first column (for rounded corners)
 * @param isLastColumn - Whether this is the last column (for rounded corners)
 * @returns Class string for non-sortable table header cells
 */
export const getTableHeaderCellClassesNonSortable = (
  isFirstColumn = false,
  isLastColumn = false
) =>
  cn(
    "font-semibold text-gray-700 dark:text-gray-300 py-3 px-4",
    isFirstColumn && "rounded-tl-lg",
    isLastColumn && "rounded-tr-lg"
  );

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
    index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800",
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
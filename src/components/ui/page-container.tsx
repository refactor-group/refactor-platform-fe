import { cn } from "@/components/lib/utils";

/// A reusable parent page container that contains and provides all children components
/// the right style to adhere to the right max width and padding from the sidebar.
export function PageContainer({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={cn(
        // Base styles
        "p-4",
        // Mobile: stack vertically
        "flex flex-col gap-6",
        // Never grow wider than the site-header
        "max-w-screen-2xl",
        // Ensure full width for children
        "[&>*]:w-full"
      )}
    >
      {children}
    </div>
  );
}

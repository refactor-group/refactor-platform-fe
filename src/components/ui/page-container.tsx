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
        // Constrain width to a reasonable maximum while allowing flexibility
        "w-full max-w-screen-2xl",
        // Ensure children respect the container width
        "[&>*]:w-full"
      )}
    >
      {children}
    </div>
  );
}

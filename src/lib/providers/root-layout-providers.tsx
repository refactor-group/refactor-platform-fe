"use client";

import { ThemeProvider } from "@/components/ui/providers";
import { Providers } from "@/components/providers";

export function RootLayoutProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Provides shared app state providers to all child pages/components/functions */}
      <Providers>
        {children}
      </Providers>
    </ThemeProvider>
  );
}

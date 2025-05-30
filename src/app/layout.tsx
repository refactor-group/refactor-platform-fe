import type React from "react";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

import { RootLayoutProviders } from "@/lib/providers/root-layout-providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Next.js",
  description: "Generated by Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Suppress SSR hydration warnings for the initial layout to avoid the ThemeProvider
    // setting an out-of-sync theme class between server and client sides
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootLayoutProviders>{children}</RootLayoutProviders>
      </body>
    </html>
  );
}

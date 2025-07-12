import { ReactNode } from "react";
import { Providers } from "@/components/providers";

export function TestProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}

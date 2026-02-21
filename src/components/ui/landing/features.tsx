import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Layers, Target, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Layers className="h-8 w-8" />,
    title: "One shared workspace",
    description:
      "Coach and client collaborate in real time — live session notes, shared agendas, and a single source of truth that both sides own.",
  },
  {
    icon: <Target className="h-8 w-8" />,
    title: "Commitments, not to-do lists",
    description:
      "Actions surface from the conversation and carry forward automatically. No copy-pasting between tools, no forgotten follow-ups.",
  },
  {
    icon: <TrendingUp className="h-8 w-8" />,
    title: "Progress you can point to",
    description:
      "A running record of sessions, completed actions, and growth over time — so coaching impact is visible, not anecdotal.",
  },
];

export function Features() {
  return (
    <section id="features" className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Everything a coaching relationship needs. Nothing it doesn&apos;t.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Refactor Coach replaces the patchwork of docs, spreadsheets, and
          calendar reminders with a purpose-built system for the work that
          happens between sessions.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border bg-card">
              <CardHeader>
                <div className="mb-2 text-primary">{feature.icon}</div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

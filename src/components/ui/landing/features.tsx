import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { MessageSquare, Target, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <MessageSquare className="h-8 w-8" />,
    title: "Structured Sessions",
    description:
      "Run focused coaching sessions with real-time collaborative notes, keeping every conversation productive and on track.",
  },
  {
    icon: <Target className="h-8 w-8" />,
    title: "Action Tracking",
    description:
      "Turn insights into outcomes. Track action items across sessions so nothing falls through the cracks.",
  },
  {
    icon: <TrendingUp className="h-8 w-8" />,
    title: "Measurable Growth",
    description:
      "See progress over time with session history and completed actions that demonstrate real development.",
  },
];

export function Features() {
  return (
    <section id="features" className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Coaching that drives results
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Everything you need to run effective coaching relationships, from
          first session to lasting change.
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

import type { Metadata } from "next";
import { DashboardContainer } from "./dashboard-container";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Coaching dashboard",
};

export default function DashboardPage() {
  return <DashboardContainer />;
}

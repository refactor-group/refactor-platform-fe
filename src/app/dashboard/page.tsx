import type { Metadata } from "next";
import { DashboardContent } from "./dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Coaching dashboard",
};

export default function DashboardPage() {
  return <DashboardContent />;
}

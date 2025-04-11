import type { Metadata } from "next";
import { DashboardContainer } from "../../components/ui/dashboard/dashboard-container";
import { PageContainer } from "@/components/ui/page-container";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Coaching dashboard",
};

export default function DashboardPage() {
  return (
    <PageContainer>
      <DashboardContainer />
    </PageContainer>
  );
}

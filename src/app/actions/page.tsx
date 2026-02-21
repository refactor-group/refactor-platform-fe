import { siteConfig } from "@/site.config";
import { ActionsPageContainer } from "@/components/ui/actions/actions-page-container";
import { PageContainer } from "@/components/ui/page-container";

export default function ActionsPage() {
  return (
    <PageContainer>
      <ActionsPageContainer locale={siteConfig.locale} />
    </PageContainer>
  );
}

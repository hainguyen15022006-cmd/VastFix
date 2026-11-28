import { ManagerIssueDetail } from "@/components/manager/manager-issue-detail";

export default async function ManagerIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManagerIssueDetail id={id} />;
}

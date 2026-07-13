import AssignmentDetailClient from "./assignment-detail-client";

type AssignmentDetailPageProps = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const { assignmentId } = await params;
  return <AssignmentDetailClient assignmentId={assignmentId} />;
}

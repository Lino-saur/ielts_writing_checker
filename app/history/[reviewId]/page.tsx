import HistoryDetailPageClient from "../history-detail-client";

type HistoryReviewDetailPageProps = {
  params: Promise<{
    reviewId: string;
  }>;
};

export default async function HistoryReviewDetailPage({ params }: HistoryReviewDetailPageProps) {
  const { reviewId } = await params;
  return <HistoryDetailPageClient reviewId={reviewId} />;
}

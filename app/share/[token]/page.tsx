import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedWritingReview } from "@/lib/review-sharing";
import SharedReviewClient from "./shared-review-client";

export const metadata: Metadata = {
  title: "Shared IELTS writing review",
  description: "A read-only IELTS writing review shared with you.",
  robots: { index: false, follow: false }
};

type SharedReviewPageProps = { params: Promise<{ token: string }> };

export default async function SharedReviewPage({ params }: SharedReviewPageProps) {
  const { token } = await params;
  const sharedReview = await getSharedWritingReview(token);
  if (!sharedReview) notFound();
  return <SharedReviewClient sharedReview={sharedReview} />;
}

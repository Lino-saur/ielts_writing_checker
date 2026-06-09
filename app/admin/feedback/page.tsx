import { redirect } from "next/navigation";
import { FeedbackInboxClient } from "@/components/admin/feedback-inbox-client";
import { requireAdminSession } from "@/lib/admin/auth";
import { normalizeAdminFeedbackFilters } from "@/lib/admin/feedback";

type AdminFeedbackPageProps = {
  searchParams?: Promise<{
    kind?: string;
    status?: string;
    helpful?: string;
    q?: string;
  }>;
};

export default async function AdminFeedbackPage({ searchParams }: AdminFeedbackPageProps) {
  try {
    await requireAdminSession();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/admin/login");
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/admin/unauthorized");
    }
    throw error;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = normalizeAdminFeedbackFilters(resolvedSearchParams);

  return <FeedbackInboxClient filters={filters} />;
}

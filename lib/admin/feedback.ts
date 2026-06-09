import { listFeedbackEntries, type FeedbackListFilters } from "@/lib/feedback";
import type { FeedbackEntry, FeedbackStatus } from "@/lib/types";

export type AdminFeedbackFilters = {
  kind: FeedbackEntry["kind"] | "all";
  status: FeedbackStatus | "all";
  helpful: "all" | "helpful" | "not_helpful" | "unrated";
  q: string;
};

export function normalizeAdminFeedbackFilters(searchParams?: {
  kind?: string;
  status?: string;
  helpful?: string;
  q?: string;
}): AdminFeedbackFilters {
  const kind = searchParams?.kind;
  const status = searchParams?.status;
  const helpful = searchParams?.helpful;

  return {
    kind:
      kind === "review" || kind === "product" || kind === "bug" || kind === "feature_request" ? kind : "all",
    status: status === "new" || status === "reviewing" || status === "closed" ? status : "all",
    helpful:
      helpful === "helpful" || helpful === "not_helpful" || helpful === "unrated" ? helpful : "all",
    q: searchParams?.q?.trim() || ""
  };
}

export async function getAdminFeedbackDashboard(filters: AdminFeedbackFilters) {
  const items = await listFeedbackEntries(filters satisfies FeedbackListFilters);

  return {
    items,
    stats: {
      total: items.length,
      newCount: items.filter((item) => item.status === "new").length,
      bugCount: items.filter((item) => item.kind === "bug").length,
      reviewCount: items.filter((item) => item.kind === "review").length
    }
  };
}

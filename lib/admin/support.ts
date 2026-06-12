import type { SupportInboxStatus } from "@/lib/types";
import { listSupportInbox } from "@/lib/support-inbox";

export type AdminSupportFilters = {
  status: SupportInboxStatus | "all";
  q: string;
};

export function normalizeAdminSupportFilters(input: {
  status?: string;
  q?: string;
}): AdminSupportFilters {
  const status =
    input.status === "new" || input.status === "reviewing" || input.status === "closed" ? input.status : "all";

  return {
    status,
    q: input.q?.trim() || ""
  };
}

export async function getAdminSupportDashboard(filters: AdminSupportFilters) {
  return listSupportInbox({
    status: filters.status,
    q: filters.q,
    limit: 100
  });
}

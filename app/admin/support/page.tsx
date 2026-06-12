import { redirect } from "next/navigation";
import { SupportInboxClient } from "@/components/admin/support-inbox-client";
import { requireAdminSession } from "@/lib/admin/auth";
import { normalizeAdminSupportFilters } from "@/lib/admin/support";

type AdminSupportPageProps = {
  searchParams?: Promise<{
    status?: string;
    q?: string;
  }>;
};

export default async function AdminSupportPage({ searchParams }: AdminSupportPageProps) {
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
  const filters = normalizeAdminSupportFilters(resolvedSearchParams);

  return <SupportInboxClient filters={filters} />;
}

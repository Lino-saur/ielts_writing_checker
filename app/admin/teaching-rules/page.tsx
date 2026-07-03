import { redirect } from "next/navigation";
import { TeachingRulesAdminClient } from "@/components/admin/teaching-rules-admin-client";
import { requireAdminSession } from "@/lib/admin/auth";

export default async function AdminTeachingRulesPage() {
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

  return <TeachingRulesAdminClient />;
}

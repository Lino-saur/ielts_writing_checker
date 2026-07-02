import { redirect } from "next/navigation";
import { HistoricalPracticeAdminClient } from "@/components/admin/historical-practice-admin-client";
import { requireAdminSession } from "@/lib/admin/auth";

export default async function AdminHistoricalPracticePage() {
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

  return <HistoricalPracticeAdminClient />;
}

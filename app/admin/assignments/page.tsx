import { redirect } from "next/navigation";
import { AssignmentsAdminClient } from "@/components/admin/assignments-admin-client";
import { requireAdminSession } from "@/lib/admin/auth";

export default async function AdminAssignmentsPage() {
  try {
    await requireAdminSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHORIZED") {
      redirect("/admin/login");
    }
    if (message === "FORBIDDEN") {
      redirect("/admin/unauthorized");
    }
    throw error;
  }

  return <AssignmentsAdminClient />;
}

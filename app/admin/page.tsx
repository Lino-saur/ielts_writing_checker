import { redirect } from "next/navigation";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminDashboardData } from "@/lib/admin/dashboard";

export const metadata = { title: "运营看板" };

export default async function AdminDashboardPage() {
  try {
    await requireAdminSession();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/admin/login");
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/admin/unauthorized");
    throw error;
  }
  return <AdminDashboardClient initialData={await getAdminDashboardData()} />;
}

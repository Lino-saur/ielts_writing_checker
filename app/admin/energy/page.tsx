import { redirect } from "next/navigation";
import { EnergyGrantClient } from "@/components/admin/energy-grant-client";
import { requireAdminSession } from "@/lib/admin/auth";

export default async function AdminEnergyPage() {
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

  return <EnergyGrantClient />;
}

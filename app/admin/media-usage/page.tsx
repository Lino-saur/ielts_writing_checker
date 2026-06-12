import { redirect } from "next/navigation";
import { MediaUsageClient } from "@/components/admin/media-usage-client";
import { requireAdminSession } from "@/lib/admin/auth";

export default async function AdminMediaUsagePage() {
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

  return <MediaUsageClient />;
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { requireAdminSession } from "@/lib/admin/auth";

export const metadata = {
  title: "Admin"
};

export default async function AdminEntryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  try {
    await requireAdminSession();
    redirect("/admin/feedback");
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/admin/unauthorized");
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/admin/login");
    }

    throw error;
  }
}

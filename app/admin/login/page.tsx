import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getSession } from "@/lib/auth-session";
import { requireAdminSession } from "@/lib/admin/auth";

export const metadata = {
  title: "Admin Login"
};

export default async function AdminLoginPage() {
  const session = await getSession();

  if (session) {
    try {
      await requireAdminSession();
      redirect("/admin/feedback");
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return <AdminLoginForm mode="forbidden" userEmail={session.user.email} />;
      }

      if (!(error instanceof Error && error.message === "UNAUTHORIZED")) {
        throw error;
      }
    }
  }

  return <AdminLoginForm mode="login" userEmail={session?.user.email} />;
}

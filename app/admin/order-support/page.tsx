import { redirect } from "next/navigation";
import { OrderSupportAdminClient } from "@/components/admin/order-support-admin-client";
import { requireAdminSession } from "@/lib/admin/auth";

export default async function AdminOrderSupportPage() {
  try {
    await requireAdminSession();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/admin/login");
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/admin/unauthorized");
    throw error;
  }
  return <OrderSupportAdminClient />;
}

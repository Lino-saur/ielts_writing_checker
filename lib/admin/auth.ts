import { requireSession } from "@/lib/auth-session";
import type { AdminUserRole } from "@/lib/types";
import { findAdminUserBySessionIdentity } from "./users";

export async function requireAdminSession() {
  const session = await requireSession();

  const adminUser = await findAdminUserBySessionIdentity({
    authUserId: session.user.id,
    email: session.user.email
  });

  if (!adminUser || adminUser.status !== "active") {
    throw new Error("FORBIDDEN");
  }

  return {
    session,
    adminUser
  };
}

export async function requireAdminRole(allowedRoles: AdminUserRole[]) {
  const context = await requireAdminSession();
  if (context.adminUser.role !== "owner" && !allowedRoles.includes(context.adminUser.role)) {
    throw new Error("FORBIDDEN");
  }
  return context;
}

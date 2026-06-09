import { requireSession } from "@/lib/auth-session";
import { findAdminUserBySessionIdentity } from "./users";

export async function requireAdminSession() {
  const session = await requireSession();

  if (session.user.isAnonymous) {
    throw new Error("UNAUTHORIZED");
  }

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

import { db, ensureDatabase } from "@/lib/db";
import type { AdminUserEntry, AdminUserRole, AdminUserStatus } from "@/lib/types";

type AdminUserRow = {
  id: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  status: AdminUserStatus;
  role: AdminUserRole;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapAdminUserRow(row: AdminUserRow): AdminUserEntry {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export async function findAdminUserBySessionIdentity(input: { authUserId: string; email?: string | null }) {
  await ensureDatabase();

  const params: string[] = [input.authUserId];
  let emailClause = "";

  if (input.email) {
    params.push(input.email);
    emailClause = ` OR email = $${params.length}`;
  }

  const result = await db.query<AdminUserRow>(
    `SELECT id, auth_user_id, email, display_name, status, role, created_at, updated_at
     FROM admin_users
     WHERE auth_user_id = $1${emailClause}
     ORDER BY auth_user_id = $1 DESC
     LIMIT 1`,
    params
  );

  return result.rows[0] ? mapAdminUserRow(result.rows[0]) : null;
}

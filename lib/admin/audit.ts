import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "@/lib/db";

export async function recordAdminAudit(input: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await ensureDatabase();
  await db.query(
    `INSERT INTO admin_audit_logs (
       id, admin_user_id, action, target_type, target_id, detail_json, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
    [
      randomUUID(),
      input.adminUserId,
      input.action,
      input.targetType,
      input.targetId ?? null,
      JSON.stringify(input.detail ?? {})
    ]
  );
}

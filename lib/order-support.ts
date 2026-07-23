import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import type { OrderSupportKind, OrderSupportRequest, OrderSupportStatus, RechargeOrder } from "./types";

type SupportRow = {
  id: string;
  order_id: string;
  user_id: string;
  kind: OrderSupportKind;
  status: OrderSupportStatus;
  reason: string;
  details: string;
  requested_refund_cents: number | null;
  approved_refund_cents: number | null;
  admin_note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  resolved_at: Date | string | null;
};

type AdminSupportRow = SupportRow & {
  product_name: string;
  amount_cents: number;
  currency: string;
  order_status: RechargeOrder["status"];
  total_energy_amount: number;
  unlimited_days: number | null;
};

function mapSupport(row: SupportRow): OrderSupportRequest {
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    kind: row.kind,
    status: row.status,
    reason: row.reason,
    details: row.details,
    requestedRefundCents: row.requested_refund_cents === null ? null : Number(row.requested_refund_cents),
    approvedRefundCents: row.approved_refund_cents === null ? null : Number(row.approved_refund_cents),
    adminNote: row.admin_note,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null
  };
}

export async function listOrderSupportForUser(userId: string) {
  await ensureDatabase();
  const result = await db.query<SupportRow>(
    `SELECT id, order_id, user_id, kind, status, reason, details, requested_refund_cents,
            approved_refund_cents, admin_note, created_at, updated_at, resolved_at
     FROM order_support_requests
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(mapSupport);
}

export async function createOrderSupportRequest(input: {
  userId: string;
  orderId: string;
  kind: OrderSupportKind;
  reason: string;
  details?: string;
}) {
  await ensureDatabase();
  const order = await db.query<{ amount_cents: number; status: RechargeOrder["status"] }>(
    `SELECT amount_cents, status FROM recharge_orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [input.orderId, input.userId]
  );
  if (!order.rows[0]) throw new Error("RECHARGE_ORDER_NOT_FOUND");
  if (input.kind === "refund" && order.rows[0].status !== "paid") throw new Error("ORDER_NOT_REFUNDABLE");

  const now = new Date().toISOString();
  const result = await db.query<SupportRow>(
    `INSERT INTO order_support_requests (
       id, order_id, user_id, kind, status, reason, details, requested_refund_cents,
       approved_refund_cents, admin_note, created_at, updated_at, resolved_at
     ) VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, NULL, NULL, $8, $8, NULL)
     RETURNING id, order_id, user_id, kind, status, reason, details, requested_refund_cents,
               approved_refund_cents, admin_note, created_at, updated_at, resolved_at`,
    [
      randomUUID(),
      input.orderId,
      input.userId,
      input.kind,
      input.reason.trim(),
      input.details?.trim() || "",
      input.kind === "refund" ? Number(order.rows[0].amount_cents) : null,
      now
    ]
  );
  return mapSupport(result.rows[0]);
}

export async function listOrderSupportForAdmin() {
  await ensureDatabase();
  const result = await db.query<AdminSupportRow>(
    `SELECT s.id, s.order_id, s.user_id, s.kind, s.status, s.reason, s.details,
            s.requested_refund_cents, s.approved_refund_cents, s.admin_note,
            s.created_at, s.updated_at, s.resolved_at,
            o.product_name, o.amount_cents, o.currency, o.status AS order_status,
            o.total_energy_amount, o.unlimited_days
     FROM order_support_requests s
     JOIN recharge_orders o ON o.id = s.order_id
     ORDER BY CASE s.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, s.created_at ASC`
  );
  return result.rows.map((row) => ({
    ...mapSupport(row),
    order: {
      productName: row.product_name,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.order_status,
      totalEnergyAmount: Number(row.total_energy_amount),
      unlimitedDays: row.unlimited_days === null ? null : Number(row.unlimited_days)
    }
  }));
}

export async function updateOrderSupportStatus(input: {
  requestId: string;
  action: "review" | "reject" | "resolve" | "refund";
  adminNote?: string;
}) {
  await ensureDatabase();
  if (input.action === "refund") return processSimulatedRefund(input.requestId, input.adminNote);

  const status: OrderSupportStatus = input.action === "review" ? "reviewing" : input.action === "reject" ? "rejected" : "approved";
  const now = new Date().toISOString();
  const result = await db.query<SupportRow>(
    `UPDATE order_support_requests
     SET status = $2, admin_note = $3, updated_at = $4,
         resolved_at = CASE WHEN $2 IN ('approved', 'rejected') THEN $4 ELSE NULL END
     WHERE id = $1 AND status NOT IN ('refunded')
     RETURNING id, order_id, user_id, kind, status, reason, details, requested_refund_cents,
               approved_refund_cents, admin_note, created_at, updated_at, resolved_at`,
    [input.requestId, status, input.adminNote?.trim() || null, now]
  );
  if (!result.rows[0]) throw new Error("ORDER_SUPPORT_NOT_FOUND");
  return mapSupport(result.rows[0]);
}

async function processSimulatedRefund(requestId: string, adminNote?: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const supportResult = await client.query<SupportRow>(
      `SELECT id, order_id, user_id, kind, status, reason, details, requested_refund_cents,
              approved_refund_cents, admin_note, created_at, updated_at, resolved_at
       FROM order_support_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );
    const support = supportResult.rows[0];
    if (!support || support.kind !== "refund") throw new Error("ORDER_SUPPORT_NOT_FOUND");
    if (support.status === "refunded") {
      await client.query("COMMIT");
      return mapSupport(support);
    }

    const orderResult = await client.query<{
      id: string; user_id: string; status: RechargeOrder["status"]; amount_cents: number;
      total_energy_amount: number; unlimited_days: number | null; paid_at: Date | string | null;
    }>(
      `SELECT id, user_id, status, amount_cents, total_energy_amount, unlimited_days, paid_at
       FROM recharge_orders WHERE id = $1 FOR UPDATE`,
      [support.order_id]
    );
    const order = orderResult.rows[0];
    if (!order || order.user_id !== support.user_id || order.status !== "paid") throw new Error("ORDER_NOT_REFUNDABLE");

    const usage = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM energy_transactions
       WHERE user_id = $1 AND type = 'consume' AND created_at >= $2`,
      [order.user_id, order.paid_at]
    );
    if (Number(usage.rows[0]?.count || 0) > 0) throw new Error("ORDER_BENEFIT_ALREADY_USED");

    const now = new Date().toISOString();
    if (Number(order.unlimited_days) > 0) {
      const pass = await client.query<{ created_at: Date | string }>(
        `DELETE FROM unlimited_review_passes WHERE order_id = $1 RETURNING created_at`,
        [order.id]
      );
      if (!pass.rows[0]) throw new Error("ORDER_BENEFIT_NOT_FOUND");
      await client.query(
        `UPDATE unlimited_review_passes
         SET expires_at = expires_at - ($1 * INTERVAL '1 day')
         WHERE user_id = $2 AND created_at > $3`,
        [order.unlimited_days, order.user_id, pass.rows[0].created_at]
      );
    } else {
      const account = await client.query<{ balance: number; total_recharged: number }>(
        `SELECT balance, total_recharged FROM energy_accounts WHERE user_id = $1 FOR UPDATE`,
        [order.user_id]
      );
      const credits = Number(order.total_energy_amount);
      if (!account.rows[0] || Number(account.rows[0].balance) < credits) throw new Error("ORDER_BENEFIT_ALREADY_USED");
      const nextBalance = Number(account.rows[0].balance) - credits;
      await client.query(
        `UPDATE energy_accounts
         SET balance = $1, total_recharged = GREATEST(0, total_recharged - $2), updated_at = $3
         WHERE user_id = $4`,
        [nextBalance, credits, now, order.user_id]
      );
      await client.query(
        `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, order_id, source, created_at)
         VALUES ($1, $2, 'refund_reversal', $3, $4, $5, 'simulated_refund', $6)`,
        [randomUUID(), order.user_id, -credits, nextBalance, order.id, now]
      );
    }

    await client.query(`UPDATE recharge_orders SET status = 'refunded', updated_at = $2 WHERE id = $1`, [order.id, now]);
    const updated = await client.query<SupportRow>(
      `UPDATE order_support_requests
       SET status = 'refunded', approved_refund_cents = $2, admin_note = $3,
           updated_at = $4, resolved_at = $4
       WHERE id = $1
       RETURNING id, order_id, user_id, kind, status, reason, details, requested_refund_cents,
                 approved_refund_cents, admin_note, created_at, updated_at, resolved_at`,
      [requestId, order.amount_cents, adminNote?.trim() || null, now]
    );
    await client.query("COMMIT");
    return mapSupport(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

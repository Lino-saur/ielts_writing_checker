import type { PoolClient } from "pg";
import { db, ensureDatabase } from "./db";
import {
  consumeEnergyInTransaction,
  getReviewEnergyCost,
  refundReviewEnergyInTransaction,
  type EnergyState
} from "./energy";

const STALE_REQUEST_MINUTES = 10;

type ReviewRequestRow = {
  id: string;
  request_hash: string | null;
  status: "pending" | "completed" | "failed";
  energy_cost: number;
  review_id: string | null;
  created_at: Date | string;
};

export type BeginReviewRequestResult =
  | { status: "reserved"; energy: EnergyState }
  | { status: "pending" }
  | { status: "completed"; reviewId: string }
  | { status: "failed" }
  | { status: "conflict" };

async function refundPendingRequest(client: PoolClient, userId: string, request: ReviewRequestRow, errorCode: string) {
  await refundReviewEnergyInTransaction(client, userId, request.energy_cost, request.id);
  await client.query(
    `UPDATE ai_review_requests
     SET status = 'failed', error_code = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [request.id, userId, errorCode]
  );
}

export async function beginReviewRequest(
  userId: string,
  requestId: string,
  requestHash: string
): Promise<BeginReviewRequestResult> {
  await ensureDatabase();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`ai-review:${userId}`]);

    const existing = await client.query<ReviewRequestRow>(
      `SELECT id, request_hash, status, energy_cost, review_id, created_at
       FROM ai_review_requests
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [requestId, userId]
    );
    const existingRequest = existing.rows[0];

    if (existingRequest) {
      if (existingRequest.request_hash !== requestHash) {
        await client.query("COMMIT");
        return { status: "conflict" };
      }
      if (existingRequest.status === "completed" && existingRequest.review_id) {
        await client.query("COMMIT");
        return { status: "completed", reviewId: existingRequest.review_id };
      }
      if (existingRequest.status === "pending") {
        const ageMs = Date.now() - new Date(existingRequest.created_at).getTime();
        if (ageMs >= STALE_REQUEST_MINUTES * 60_000) {
          await refundPendingRequest(client, userId, existingRequest, "STALE_REQUEST");
          await client.query("COMMIT");
          return { status: "failed" };
        }
        await client.query("COMMIT");
        return { status: "pending" };
      }
      await client.query("COMMIT");
      return { status: "failed" };
    }

    const pending = await client.query<ReviewRequestRow>(
      `SELECT id, request_hash, status, energy_cost, review_id, created_at
       FROM ai_review_requests
       WHERE user_id = $1 AND status = 'pending'
       FOR UPDATE`,
      [userId]
    );
    const pendingRequest = pending.rows[0];

    if (pendingRequest) {
      const ageMs = Date.now() - new Date(pendingRequest.created_at).getTime();
      if (ageMs < STALE_REQUEST_MINUTES * 60_000) {
        await client.query("COMMIT");
        return { status: "pending" };
      }
      await refundPendingRequest(client, userId, pendingRequest, "STALE_REQUEST");
    }

    const energyCost = getReviewEnergyCost();
    const energy = await consumeEnergyInTransaction(client, userId, energyCost, {
      source: "review_reservation",
      orderId: requestId
    });
    await client.query(
      `INSERT INTO ai_review_requests (
        id, user_id, request_hash, status, energy_cost, review_id, error_code, created_at, updated_at
      )
      VALUES ($1, $2, $3, 'pending', $4, NULL, NULL, NOW(), NOW())`,
      [requestId, userId, requestHash, energyCost]
    );

    await client.query("COMMIT");
    return { status: "reserved", energy };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function failReviewRequest(userId: string, requestId: string, errorCode: string) {
  await ensureDatabase();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<ReviewRequestRow>(
      `SELECT id, request_hash, status, energy_cost, review_id, created_at
       FROM ai_review_requests
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [requestId, userId]
    );
    const request = result.rows[0];

    if (request?.status === "pending") {
      await refundPendingRequest(client, userId, request, errorCode);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db, ensureDatabase } from "./db";
import type { FeedbackEntry, FeedbackPayload, FeedbackStatus } from "./types";

const RECHARGE_WAITLIST_CATEGORY = "recharge_waitlist";
const RECHARGE_WAITLIST_REWARD = 10;
const DEFAULT_ENERGY_BALANCE = 20;

type CreateFeedbackInput = FeedbackPayload & {
  userId: string;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  kind: FeedbackEntry["kind"];
  status: FeedbackStatus;
  helpful: boolean | null;
  category: string | null;
  comment: string;
  page: string;
  task_type: FeedbackEntry["taskType"];
  target_band: number | string | null;
  provider_used: FeedbackEntry["providerUsed"];
  feedback_mode: FeedbackEntry["feedbackMode"];
  estimated_band: number | string | null;
  word_count: number | null;
  payload_json: Record<string, unknown> | null;
  created_at: Date | string;
};

type UserColumnRow = {
  column_name: string;
};

type UserRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  display_name?: string | null;
};

type FeedbackUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type EnergyRow = {
  balance: number;
  total_consumed: number;
  total_recharged: number;
  updated_at: Date | string;
};

export type FeedbackListFilters = {
  kind?: FeedbackEntry["kind"] | "all";
  status?: FeedbackStatus | "all";
  helpful?: "all" | "helpful" | "not_helpful" | "unrated";
  q?: string;
  limit?: number;
};

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function getUserTableColumns() {
  await ensureDatabase();

  const result = await db.query<UserColumnRow>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'user'`
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function getFeedbackUsersByIds(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, FeedbackUser>();
  }

  const columns = await getUserTableColumns();
  if (!columns.has("id")) {
    return new Map<string, FeedbackUser>();
  }

  const nameColumn = columns.has("name") ? "name" : columns.has("display_name") ? "display_name" : null;
  const selectColumns = [
    `${quoteIdentifier("id")} AS id`,
    columns.has("email") ? `${quoteIdentifier("email")} AS email` : `NULL::TEXT AS email`,
    nameColumn ? `${quoteIdentifier(nameColumn)} AS ${quoteIdentifier(nameColumn)}` : `NULL::TEXT AS name`
  ];

  const result = await db.query<UserRow>(
    `SELECT ${selectColumns.join(", ")}
     FROM ${quoteIdentifier("user")}
     WHERE ${quoteIdentifier("id")} = ANY($1)`,
    [userIds]
  );

  return new Map(
    result.rows.map((row) => [
      row.id,
      {
        id: row.id,
        email: row.email ?? null,
        name: row.name ?? row.display_name ?? null
      } satisfies FeedbackUser
    ])
  );
}

function mapFeedbackRow(row: FeedbackRow, user?: FeedbackUser): FeedbackEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    kind: row.kind,
    status: row.status,
    helpful: row.helpful,
    category: row.category,
    comment: row.comment,
    page: row.page,
    taskType: row.task_type,
    targetBand: row.target_band == null ? null : Number(row.target_band),
    providerUsed: row.provider_used,
    feedbackMode: row.feedback_mode,
    estimatedBand: row.estimated_band == null ? null : Number(row.estimated_band),
    wordCount: row.word_count,
    payload: row.payload_json ?? {},
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function createFeedback(input: CreateFeedbackInput) {
  await ensureDatabase();

  const createdAt = new Date().toISOString();
  const comment = input.comment?.trim() ?? "";
  const category = input.category?.trim() || null;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO feedback_entries (
        id,
        user_id,
        kind,
        status,
        helpful,
        category,
        comment,
        page,
        task_type,
        target_band,
        provider_used,
        feedback_mode,
        estimated_band,
        word_count,
        payload_json,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16)`,
      [
        randomUUID(),
        input.userId,
        input.kind,
        "new",
        input.helpful,
        category,
        comment,
        input.page,
        input.taskType ?? null,
        input.targetBand ?? null,
        input.providerUsed ?? null,
        input.feedbackMode ?? null,
        input.estimatedBand ?? null,
        input.wordCount ?? null,
        JSON.stringify(input.context ?? {}),
        createdAt
      ]
    );

    let rewardGranted = false;

    if (category === RECHARGE_WAITLIST_CATEGORY) {
      rewardGranted = await grantRechargeWaitlistReward(client, input.userId, createdAt);
    }

    await client.query("COMMIT");

    return {
      ok: true,
      createdAt,
      rewardGranted,
      rewardAmount: rewardGranted ? RECHARGE_WAITLIST_REWARD : 0
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function grantRechargeWaitlistReward(
  client: PoolClient,
  userId: string,
  createdAt: string
) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`recharge-waitlist:${userId}`]);

  const existingReward = await client.query<{ id: string }>(
    `SELECT id
     FROM energy_transactions
     WHERE user_id = $1 AND source = $2
     LIMIT 1`,
    [userId, RECHARGE_WAITLIST_CATEGORY]
  );

  if (existingReward.rows[0]) {
    return false;
  }

  let existingAccount = await client.query<EnergyRow>(
    `SELECT balance, total_consumed, total_recharged, updated_at
     FROM energy_accounts
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  if (!existingAccount.rows[0]) {
    await client.query(
      `INSERT INTO energy_accounts (user_id, balance, total_consumed, total_recharged, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, DEFAULT_ENERGY_BALANCE, 0, DEFAULT_ENERGY_BALANCE, createdAt]
    );

    await client.query(
      `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), userId, "recharge", DEFAULT_ENERGY_BALANCE, DEFAULT_ENERGY_BALANCE, "bootstrap", createdAt]
    );

    existingAccount = await client.query<EnergyRow>(
      `SELECT balance, total_consumed, total_recharged, updated_at
       FROM energy_accounts
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );
  }

  const current = existingAccount.rows[0];
  const nextBalance = Number(current.balance) + RECHARGE_WAITLIST_REWARD;
  const nextTotalRecharged = Number(current.total_recharged) + RECHARGE_WAITLIST_REWARD;

  await client.query(
    `UPDATE energy_accounts
     SET balance = $1, total_recharged = $2, updated_at = $3
     WHERE user_id = $4`,
    [nextBalance, nextTotalRecharged, createdAt, userId]
  );

  await client.query(
    `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), userId, "recharge", RECHARGE_WAITLIST_REWARD, nextBalance, RECHARGE_WAITLIST_CATEGORY, createdAt]
  );

  return true;
}

export async function listFeedbackEntries(filters: FeedbackListFilters = {}) {
  await ensureDatabase();

  const conditions: string[] = [];
  const values: Array<string | number | boolean> = [];

  if (filters.kind && filters.kind !== "all") {
    values.push(filters.kind);
    conditions.push(`kind = $${values.length}`);
  }

  if (filters.status && filters.status !== "all") {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.helpful === "helpful") {
    conditions.push("helpful = true");
  } else if (filters.helpful === "not_helpful") {
    conditions.push("helpful = false");
  } else if (filters.helpful === "unrated") {
    conditions.push("helpful IS NULL");
  }

  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    conditions.push(`(comment ILIKE $${values.length} OR page ILIKE $${values.length} OR user_id ILIKE $${values.length})`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  values.push(limit);

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query<FeedbackRow>(
    `SELECT
      id,
      user_id,
      kind,
      status,
      helpful,
      category,
      comment,
      page,
      task_type,
      target_band,
      provider_used,
      feedback_mode,
      estimated_band,
      word_count,
      payload_json,
      created_at
    FROM feedback_entries
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${values.length}`,
    values
  );

  const usersById = await getFeedbackUsersByIds([...new Set(result.rows.map((row) => row.user_id))]);

  return result.rows.map((row) => mapFeedbackRow(row, usersById.get(row.user_id)));
}

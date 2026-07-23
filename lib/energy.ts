import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db, ensureDatabase } from "./db";

export const REVIEW_ENERGY_COST = 1;
const DEFAULT_ENERGY_BALANCE = 20;

export type EnergyState = {
  balance: number;
  unlimitedUntil: string | null;
  totalConsumed: number;
  totalRecharged: number;
  updatedAt: string;
};

type EnergyRow = {
  balance: number;
  total_consumed: number;
  total_recharged: number;
  updated_at: Date | string;
};

function createDefaultEnergyState(): EnergyState {
  const now = new Date().toISOString();
  return {
    balance: DEFAULT_ENERGY_BALANCE,
    unlimitedUntil: null,
    totalConsumed: 0,
    totalRecharged: DEFAULT_ENERGY_BALANCE,
    updatedAt: now
  };
}

function mapEnergyRow(row: EnergyRow): EnergyState {
  return {
    balance: Number(row.balance),
    unlimitedUntil: null,
    totalConsumed: Number(row.total_consumed),
    totalRecharged: Number(row.total_recharged),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

async function addUnlimitedEntitlement(state: EnergyState, userId: string): Promise<EnergyState> {
  const result = await db.query<{ unlimited_until: Date | string | null }>(
    `SELECT MAX(expires_at) AS unlimited_until
     FROM unlimited_review_passes
     WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  const expiry = result.rows[0]?.unlimited_until;
  return {
    ...state,
    unlimitedUntil: expiry ? new Date(expiry).toISOString() : null
  };
}

async function ensureEnergyAccount(userId: string): Promise<EnergyState> {
  await ensureDatabase();

  const existing = await db.query<EnergyRow>(
    `SELECT balance, total_consumed, total_recharged, updated_at
     FROM energy_accounts
     WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows[0]) {
    return mapEnergyRow(existing.rows[0]);
  }

  const state = createDefaultEnergyState();

  await db.query(
    `INSERT INTO energy_accounts (user_id, balance, total_consumed, total_recharged, updated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, state.balance, state.totalConsumed, state.totalRecharged, state.updatedAt]
  );

  await db.query(
    `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), userId, "recharge", state.balance, state.balance, "bootstrap", state.updatedAt]
  );

  return state;
}

async function lockEnergyAccount(client: PoolClient, userId: string) {
  let existing = await client.query<EnergyRow>(
    `SELECT balance, total_consumed, total_recharged, updated_at
     FROM energy_accounts
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const defaultState = createDefaultEnergyState();
  await client.query(
    `INSERT INTO energy_accounts (user_id, balance, total_consumed, total_recharged, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, defaultState.balance, defaultState.totalConsumed, defaultState.totalRecharged, defaultState.updatedAt]
  );

  await client.query(
    `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [randomUUID(), userId, "recharge", defaultState.balance, defaultState.balance, "bootstrap", defaultState.updatedAt]
  );

  existing = await client.query<EnergyRow>(
    `SELECT balance, total_consumed, total_recharged, updated_at
     FROM energy_accounts
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  return existing.rows[0];
}

export async function getEnergyState(userId: string): Promise<EnergyState> {
  return addUnlimitedEntitlement(await ensureEnergyAccount(userId), userId);
}

export async function consumeEnergy(userId: string, amount = REVIEW_ENERGY_COST): Promise<EnergyState> {
  const client = await db.connect();

  try {
    await ensureDatabase();
    await client.query("BEGIN");
    const nextState = await consumeEnergyInTransaction(client, userId, amount);

    await client.query("COMMIT");
    return nextState;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeEnergyInTransaction(
  client: PoolClient,
  userId: string,
  amount = REVIEW_ENERGY_COST,
  options?: {
    source?: string;
    orderId?: string | null;
  }
) {
  const state = mapEnergyRow(await lockEnergyAccount(client, userId));

  const passResult = await client.query<{ unlimited_until: Date | string | null }>(
    `SELECT MAX(expires_at) AS unlimited_until
     FROM unlimited_review_passes
     WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  const unlimitedUntil = passResult.rows[0]?.unlimited_until;
  const hasUnlimitedPass = Boolean(unlimitedUntil);

  if (!hasUnlimitedPass && state.balance < amount) {
    throw new Error("INSUFFICIENT_ENERGY");
  }

  const updatedAt = new Date().toISOString();
  const nextState: EnergyState = {
    balance: hasUnlimitedPass ? state.balance : state.balance - amount,
    unlimitedUntil: unlimitedUntil ? new Date(unlimitedUntil).toISOString() : null,
    totalConsumed: state.totalConsumed + amount,
    totalRecharged: state.totalRecharged,
    updatedAt
  };

  await client.query(
    `UPDATE energy_accounts
     SET balance = $1, total_consumed = $2, updated_at = $3
     WHERE user_id = $4`,
    [nextState.balance, nextState.totalConsumed, nextState.updatedAt, userId]
  );

  await client.query(
    `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, order_id, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      userId,
      "consume",
      amount,
      nextState.balance,
      options?.orderId || null,
      hasUnlimitedPass ? `${options?.source || "review"}:unlimited` : options?.source || "review",
      updatedAt
    ]
  );

  return nextState;
}

export async function refundReviewEnergyInTransaction(
  client: PoolClient,
  userId: string,
  amount: number,
  requestId: string
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("INVALID_ENERGY_AMOUNT");
  }

  const state = mapEnergyRow(await lockEnergyAccount(client, userId));
  const consumption = await client.query<{ source: string | null }>(
    `SELECT source
     FROM energy_transactions
     WHERE order_id = $1 AND user_id = $2 AND type = 'consume'
     ORDER BY created_at DESC
     LIMIT 1`,
    [requestId, userId]
  );
  const wasUnlimited = consumption.rows[0]?.source?.endsWith(":unlimited") ?? false;
  const updatedAt = new Date().toISOString();
  const nextState: EnergyState = {
    balance: state.balance + (wasUnlimited ? 0 : amount),
    unlimitedUntil: state.unlimitedUntil,
    totalConsumed: Math.max(0, state.totalConsumed - amount),
    totalRecharged: state.totalRecharged,
    updatedAt
  };

  await client.query(
    `UPDATE energy_accounts
     SET balance = $1, total_consumed = $2, updated_at = $3
     WHERE user_id = $4`,
    [nextState.balance, nextState.totalConsumed, nextState.updatedAt, userId]
  );

  await client.query(
    `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, order_id, source, created_at)
     VALUES ($1, $2, 'refund', $3, $4, $5, 'review_refund', $6)`,
    [randomUUID(), userId, wasUnlimited ? 0 : amount, nextState.balance, requestId, updatedAt]
  );

  return nextState;
}

export async function grantEnergy(
  userId: string,
  amount: number,
  options?: {
    source?: string;
    orderId?: string | null;
  }
): Promise<EnergyState> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("INVALID_ENERGY_AMOUNT");
  }

  const client = await db.connect();

  try {
    await ensureDatabase();
    await client.query("BEGIN");

    let existing = await client.query<EnergyRow>(
      `SELECT balance, total_consumed, total_recharged, updated_at
       FROM energy_accounts
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!existing.rows[0]) {
      const defaultState = createDefaultEnergyState();
      await client.query(
        `INSERT INTO energy_accounts (user_id, balance, total_consumed, total_recharged, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, defaultState.balance, defaultState.totalConsumed, defaultState.totalRecharged, defaultState.updatedAt]
      );

      await client.query(
        `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          randomUUID(),
          userId,
          "recharge",
          defaultState.balance,
          defaultState.balance,
          "bootstrap",
          defaultState.updatedAt
        ]
      );

      existing = await client.query<EnergyRow>(
        `SELECT balance, total_consumed, total_recharged, updated_at
         FROM energy_accounts
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
      );
    }

    const state = mapEnergyRow(existing.rows[0]);
    const updatedAt = new Date().toISOString();
    const nextState: EnergyState = {
      balance: state.balance + amount,
      unlimitedUntil: state.unlimitedUntil,
      totalConsumed: state.totalConsumed,
      totalRecharged: state.totalRecharged + amount,
      updatedAt
    };

    await client.query(
      `UPDATE energy_accounts
       SET balance = $1, total_recharged = $2, updated_at = $3
       WHERE user_id = $4`,
      [nextState.balance, nextState.totalRecharged, nextState.updatedAt, userId]
    );

    await client.query(
      `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, order_id, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        userId,
        "recharge",
        amount,
        nextState.balance,
        options?.orderId || null,
        options?.source || "admin",
        updatedAt
      ]
    );

    await client.query("COMMIT");
    return nextState;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function getReviewEnergyCost() {
  return REVIEW_ENERGY_COST;
}

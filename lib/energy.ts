import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";

export const REVIEW_ENERGY_COST = 1;
const DEFAULT_ENERGY_BALANCE = 20;

export type EnergyState = {
  balance: number;
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
    totalConsumed: 0,
    totalRecharged: DEFAULT_ENERGY_BALANCE,
    updatedAt: now
  };
}

function mapEnergyRow(row: EnergyRow): EnergyState {
  return {
    balance: Number(row.balance),
    totalConsumed: Number(row.total_consumed),
    totalRecharged: Number(row.total_recharged),
    updatedAt: new Date(row.updated_at).toISOString()
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

export async function getEnergyState(userId: string): Promise<EnergyState> {
  return ensureEnergyAccount(userId);
}

export async function consumeEnergy(userId: string, amount = REVIEW_ENERGY_COST): Promise<EnergyState> {
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

    if (state.balance < amount) {
      throw new Error("INSUFFICIENT_ENERGY");
    }

    const updatedAt = new Date().toISOString();
    const nextState: EnergyState = {
      balance: state.balance - amount,
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
      `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), userId, "consume", amount, nextState.balance, "review", updatedAt]
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

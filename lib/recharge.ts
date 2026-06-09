import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import type {
  RechargeOrder,
  RechargeOrderStatus,
  RechargePaymentSession,
  RechargeProduct,
  RechargeProvider
} from "./types";

type RechargeProductRow = {
  id: string;
  code: string;
  name: string;
  energy_amount: number;
  bonus_energy_amount: number;
  price_cents: number;
  currency: string;
  status: "active" | "inactive";
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type RechargeOrderRow = {
  id: string;
  user_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  provider: RechargeProvider;
  status: RechargeOrderStatus;
  amount_cents: number;
  currency: string;
  energy_amount: number;
  bonus_energy_amount: number;
  total_energy_amount: number;
  provider_order_id: string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type EnergyAccountRow = {
  balance: number;
  total_consumed: number;
  total_recharged: number;
  updated_at: Date | string;
};

type EnergyTransactionRow = {
  id: string;
};

const DEFAULT_ENERGY_BALANCE = 20;

function mapRechargeProduct(row: RechargeProductRow): RechargeProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    energyAmount: Number(row.energy_amount),
    bonusEnergyAmount: Number(row.bonus_energy_amount),
    priceCents: Number(row.price_cents),
    currency: row.currency,
    status: row.status,
    sortOrder: Number(row.sort_order),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapRechargeOrder(row: RechargeOrderRow): RechargeOrder {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    provider: row.provider,
    status: row.status,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    energyAmount: Number(row.energy_amount),
    bonusEnergyAmount: Number(row.bonus_energy_amount),
    totalEnergyAmount: Number(row.total_energy_amount),
    providerOrderId: row.provider_order_id,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

async function getRechargeProductByCode(code: string) {
  await ensureDatabase();

  const result = await db.query<RechargeProductRow>(
    `SELECT id, code, name, energy_amount, bonus_energy_amount, price_cents, currency, status, sort_order, created_at, updated_at
     FROM recharge_products
     WHERE code = $1
     LIMIT 1`,
    [code]
  );

  return result.rows[0] ? mapRechargeProduct(result.rows[0]) : null;
}

async function getRechargeOrderByWhere(whereSql: string, params: Array<string | null>) {
  await ensureDatabase();

  const result = await db.query<RechargeOrderRow>(
    `SELECT id, user_id, product_id, product_code, product_name, provider, status, amount_cents, currency,
            energy_amount, bonus_energy_amount, total_energy_amount, provider_order_id, paid_at, created_at, updated_at
     FROM recharge_orders
     WHERE ${whereSql}
     LIMIT 1`,
    params
  );

  return result.rows[0] ? mapRechargeOrder(result.rows[0]) : null;
}

function createDefaultEnergyState() {
  const now = new Date().toISOString();
  return {
    balance: DEFAULT_ENERGY_BALANCE,
    totalConsumed: 0,
    totalRecharged: DEFAULT_ENERGY_BALANCE,
    updatedAt: now
  };
}

export async function listRechargeProducts() {
  await ensureDatabase();

  const result = await db.query<RechargeProductRow>(
    `SELECT id, code, name, energy_amount, bonus_energy_amount, price_cents, currency, status, sort_order, created_at, updated_at
     FROM recharge_products
     WHERE status = 'active'
     ORDER BY sort_order ASC, created_at ASC`
  );

  return result.rows.map(mapRechargeProduct);
}

export function buildRechargePaymentSession(order: RechargeOrder): RechargePaymentSession {
  if (order.provider === "stripe") {
    return {
      provider: order.provider,
      mode: "redirect",
      redirectUrl: null,
      qrCodeUrl: null,
      clientPayload: null,
      message: "Stripe Checkout session integration pending."
    };
  }

  if (order.provider === "wechat") {
    return {
      provider: order.provider,
      mode: "qr_code",
      redirectUrl: null,
      qrCodeUrl: null,
      clientPayload: null,
      message: "WeChat payment session integration pending."
    };
  }

  if (order.provider === "alipay") {
    return {
      provider: order.provider,
      mode: "redirect",
      redirectUrl: null,
      qrCodeUrl: null,
      clientPayload: null,
      message: "Alipay payment session integration pending."
    };
  }

  return {
    provider: order.provider,
    mode: "pending",
    redirectUrl: null,
    qrCodeUrl: null,
    clientPayload: null,
    message: "Manual settlement only."
  };
}

export async function createRechargeOrder(input: {
  userId: string;
  productCode: string;
  provider?: RechargeProvider;
}) {
  const product = await getRechargeProductByCode(input.productCode);

  if (!product || product.status !== "active") {
    throw new Error("RECHARGE_PRODUCT_NOT_FOUND");
  }

  const provider = input.provider ?? "stripe";
  const orderId = randomUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO recharge_orders (
      id, user_id, product_id, product_code, product_name, provider, status,
      amount_cents, currency, energy_amount, bonus_energy_amount, total_energy_amount,
      provider_order_id, paid_at, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, NULL, NULL, $12, $12)`,
    [
      orderId,
      input.userId,
      product.id,
      product.code,
      product.name,
      provider,
      product.priceCents,
      product.currency,
      product.energyAmount,
      product.bonusEnergyAmount,
      product.energyAmount + product.bonusEnergyAmount,
      now
    ]
  );

  const created = await getRechargeOrderById(orderId);
  if (!created) {
    throw new Error("ORDER_CREATE_FAILED");
  }

  return created;
}

export async function getRechargeOrderById(orderId: string) {
  return getRechargeOrderByWhere("id = $1", [orderId]);
}

export async function getRechargeOrderByProviderOrderId(provider: RechargeProvider, providerOrderId: string) {
  return getRechargeOrderByWhere("provider = $1 AND provider_order_id = $2", [provider, providerOrderId]);
}

export async function listRechargeOrdersForUser(userId: string) {
  await ensureDatabase();

  const result = await db.query<RechargeOrderRow>(
    `SELECT id, user_id, product_id, product_code, product_name, provider, status, amount_cents, currency,
            energy_amount, bonus_energy_amount, total_energy_amount, provider_order_id, paid_at, created_at, updated_at
     FROM recharge_orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map(mapRechargeOrder);
}

export async function settleRechargeOrder(input: {
  orderId?: string;
  provider?: RechargeProvider;
  providerOrderId?: string | null;
  source?: string;
}) {
  if (!input.orderId && !(input.provider && input.providerOrderId)) {
    throw new Error("RECHARGE_ORDER_IDENTIFIER_REQUIRED");
  }

  const client = await db.connect();

  try {
    await ensureDatabase();
    await client.query("BEGIN");

    const params: Array<string | null> = [];
    let whereSql = "";

    if (input.orderId) {
      params.push(input.orderId);
      whereSql = "id = $1";
    } else {
      params.push(input.provider ?? null, input.providerOrderId ?? null);
      whereSql = "provider = $1 AND provider_order_id = $2";
    }

    const orderResult = await client.query<RechargeOrderRow>(
      `SELECT id, user_id, product_id, product_code, product_name, provider, status, amount_cents, currency,
              energy_amount, bonus_energy_amount, total_energy_amount, provider_order_id, paid_at, created_at, updated_at
       FROM recharge_orders
       WHERE ${whereSql}
       FOR UPDATE`,
      params
    );

    const current = orderResult.rows[0];
    if (!current) {
      throw new Error("RECHARGE_ORDER_NOT_FOUND");
    }

    if (current.status !== "pending" && current.status !== "paid") {
      throw new Error("RECHARGE_ORDER_NOT_PAYABLE");
    }

    const existingSettlement = await client.query<EnergyTransactionRow>(
      `SELECT id
       FROM energy_transactions
       WHERE order_id = $1
       LIMIT 1`,
      [current.id]
    );

    if (!existingSettlement.rows[0]) {
      let accountResult = await client.query<EnergyAccountRow>(
        `SELECT balance, total_consumed, total_recharged, updated_at
         FROM energy_accounts
         WHERE user_id = $1
         FOR UPDATE`,
        [current.user_id]
      );

      if (!accountResult.rows[0]) {
        const bootstrap = createDefaultEnergyState();
        await client.query(
          `INSERT INTO energy_accounts (user_id, balance, total_consumed, total_recharged, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id) DO NOTHING`,
          [current.user_id, bootstrap.balance, bootstrap.totalConsumed, bootstrap.totalRecharged, bootstrap.updatedAt]
        );

        await client.query(
          `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, order_id, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [randomUUID(), current.user_id, "recharge", bootstrap.balance, bootstrap.balance, null, "bootstrap", bootstrap.updatedAt]
        );

        accountResult = await client.query<EnergyAccountRow>(
          `SELECT balance, total_consumed, total_recharged, updated_at
           FROM energy_accounts
           WHERE user_id = $1
           FOR UPDATE`,
          [current.user_id]
        );
      }

      const account = accountResult.rows[0];
      const nextBalance = Number(account.balance) + Number(current.total_energy_amount);
      const nextTotalRecharged = Number(account.total_recharged) + Number(current.total_energy_amount);
      const settledAt = new Date().toISOString();

      await client.query(
        `UPDATE energy_accounts
         SET balance = $1, total_recharged = $2, updated_at = $3
         WHERE user_id = $4`,
        [nextBalance, nextTotalRecharged, settledAt, current.user_id]
      );

      await client.query(
        `INSERT INTO energy_transactions (id, user_id, type, amount, balance_after, order_id, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          current.user_id,
          "recharge",
          current.total_energy_amount,
          nextBalance,
          current.id,
          input.source || `recharge:${current.provider}:${current.product_code}`,
          settledAt
        ]
      );
    }

    if (current.status === "pending") {
      const paidAt = new Date().toISOString();
      await client.query(
        `UPDATE recharge_orders
         SET status = 'paid',
             provider_order_id = COALESCE($1, provider_order_id),
             paid_at = COALESCE(paid_at, $2),
             updated_at = $2
         WHERE id = $3`,
        [input.providerOrderId ?? null, paidAt, current.id]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const settled = await getRechargeOrderById(input.orderId || "");
  if (!settled && input.provider && input.providerOrderId) {
    const byProvider = await getRechargeOrderByProviderOrderId(input.provider, input.providerOrderId);
    if (byProvider) {
      return byProvider;
    }
  }

  if (!settled) {
    throw new Error("RECHARGE_ORDER_NOT_FOUND");
  }

  return settled;
}

export async function markRechargeOrderFailed(orderId: string) {
  await ensureDatabase();

  const updatedAt = new Date().toISOString();
  const result = await db.query<RechargeOrderRow>(
    `UPDATE recharge_orders
     SET status = 'failed', updated_at = $2
     WHERE id = $1
       AND status = 'pending'
     RETURNING id, user_id, product_id, product_code, product_name, provider, status, amount_cents, currency,
               energy_amount, bonus_energy_amount, total_energy_amount, provider_order_id, paid_at, created_at, updated_at`,
    [orderId, updatedAt]
  );

  return result.rows[0] ? mapRechargeOrder(result.rows[0]) : null;
}

export async function cancelRechargeOrder(orderId: string) {
  await ensureDatabase();

  const updatedAt = new Date().toISOString();
  const result = await db.query<RechargeOrderRow>(
    `UPDATE recharge_orders
     SET status = 'cancelled', updated_at = $2
     WHERE id = $1
       AND status = 'pending'
     RETURNING id, user_id, product_id, product_code, product_name, provider, status, amount_cents, currency,
               energy_amount, bonus_energy_amount, total_energy_amount, provider_order_id, paid_at, created_at, updated_at`,
    [orderId, updatedAt]
  );

  return result.rows[0] ? mapRechargeOrder(result.rows[0]) : null;
}

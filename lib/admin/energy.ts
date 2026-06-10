import { db, ensureDatabase } from "@/lib/db";

export type AdminEnergyUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type AdminEnergyGrantEntry = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  amount: number;
  balanceAfter: number;
  source: string;
  createdAt: string;
};

type UserColumnRow = {
  column_name: string;
};

type GrantRow = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  source: string;
  created_at: Date | string;
};

type UserRow = {
  id: string;
  email: string | null;
  name?: string | null;
  display_name?: string | null;
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

async function loadUsersByWhere(whereSql: string, params: Array<string | number | string[]>, options?: { limit?: number }) {
  const columns = await getUserTableColumns();

  if (!columns.has("id") || !columns.has("email")) {
    return [] as AdminEnergyUser[];
  }

  const nameColumn = columns.has("name") ? "name" : columns.has("display_name") ? "display_name" : null;
  const orderColumn = columns.has("updatedAt")
    ? "updatedAt"
    : columns.has("updated_at")
      ? "updated_at"
      : columns.has("createdAt")
        ? "createdAt"
        : columns.has("created_at")
          ? "created_at"
          : "id";

  const selectColumns = [
    `${quoteIdentifier("id")} AS id`,
    `${quoteIdentifier("email")} AS email`,
    nameColumn ? `${quoteIdentifier(nameColumn)} AS ${quoteIdentifier(nameColumn)}` : `NULL::TEXT AS name`
  ];

  const result = await db.query<UserRow>(
    `SELECT ${selectColumns.join(", ")}
     FROM ${quoteIdentifier("user")}
     WHERE ${whereSql}
     ORDER BY ${quoteIdentifier(orderColumn)} DESC NULLS LAST
     LIMIT $${params.length + 1}`,
    [...params, options?.limit ?? 8]
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name ?? row.display_name ?? null
  }));
}

export async function searchUsersByEmail(query: string) {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [] as AdminEnergyUser[];
  }

  return loadUsersByWhere(`${quoteIdentifier("email")} ILIKE $1`, [`%${trimmed}%`], { limit: 8 });
}

async function getUsersByIds(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, AdminEnergyUser>();
  }

  const users = await loadUsersByWhere(`${quoteIdentifier("id")} = ANY($1)`, [userIds], { limit: userIds.length });
  return new Map(users.map((user) => [user.id, user]));
}

export async function listRecentAdminGrants(limit = 12) {
  await ensureDatabase();

  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const result = await db.query<GrantRow>(
    `SELECT id, user_id, amount, balance_after, source, created_at
     FROM energy_transactions
     WHERE type = 'recharge'
       AND source LIKE 'admin:%'
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  const usersById = await getUsersByIds([...new Set(result.rows.map((row) => row.user_id))]);

  return result.rows.map((row) => {
    const user = usersById.get(row.user_id);

    return {
      id: row.id,
      userId: row.user_id,
      userEmail: user?.email ?? null,
      userName: user?.name ?? null,
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      source: row.source,
      createdAt: new Date(row.created_at).toISOString()
    } satisfies AdminEnergyGrantEntry;
  });
}

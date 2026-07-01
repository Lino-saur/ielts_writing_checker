# Database migrations

Application-owned PostgreSQL schema changes are versioned through `schema_migrations`.

Run migrations before deploying:

```bash
npm run db:migrate
```

`ensureDatabase()` also runs the migration check at runtime as a safety net. It acquires a PostgreSQL advisory lock, applies each version once in a transaction, and records the version only after the transaction succeeds.

When changing the schema:

1. Increment `CURRENT_SCHEMA_VERSION` in `lib/db.ts`.
2. Add the new migration statements behind the corresponding version check.
3. Keep migrations forward-only and safe to run against existing production data.
4. Run `npm run typecheck`, `npm run test`, and `npm run build`.

Better Auth maintains its own schema separately:

```bash
npx auth@latest migrate --config ./lib/auth.ts --yes
```

import { db, ensureDatabase } from "@/lib/db";

type SummaryRow = {
  registered_users: number;
  new_users_7d: number;
  active_users_7d: number;
  active_users_30d: number;
  total_reviews: number;
  reviews_7d: number;
  completed_reviews_7d: number;
  paid_orders: number;
  paid_users: number;
  gross_revenue_cents: number;
  refunded_orders: number;
  refunded_cents: number;
  open_support_requests: number;
};

type TrendRow = {
  day: Date | string;
  registrations: number;
  active_users: number;
  reviews: number;
  paid_orders: number;
  revenue_cents: number;
};

type PlanRow = {
  product_code: string;
  product_name: string;
  order_count: number;
  revenue_cents: number;
};

type RecentUserRow = {
  id: string;
  name: string | null;
  email: string;
  email_verified: boolean;
  created_at: Date | string;
  review_count: number;
  last_review_at: Date | string | null;
  paid_order_count: number;
};

type RecentReviewRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  task_type: string;
  status: string;
  estimated_band: number | null;
  word_count: number;
  provider_used: string;
  created_at: Date | string;
};

export async function getAdminDashboardData() {
  await ensureDatabase();
  const [summaryResult, trendResult, planResult, recentUsersResult, recentReviewsResult] = await Promise.all([
    db.query<SummaryRow>(`
      SELECT
        (SELECT COUNT(*)::integer FROM "user") AS registered_users,
        (SELECT COUNT(*)::integer FROM "user" WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS new_users_7d,
        (SELECT COUNT(DISTINCT user_id)::integer FROM writing_reviews WHERE created_at >= NOW() - INTERVAL '7 days') AS active_users_7d,
        (SELECT COUNT(DISTINCT user_id)::integer FROM writing_reviews WHERE created_at >= NOW() - INTERVAL '30 days') AS active_users_30d,
        (SELECT COUNT(*)::integer FROM writing_reviews) AS total_reviews,
        (SELECT COUNT(*)::integer FROM writing_reviews WHERE created_at >= NOW() - INTERVAL '7 days') AS reviews_7d,
        (SELECT COUNT(*)::integer FROM writing_reviews WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '7 days') AS completed_reviews_7d,
        (SELECT COUNT(*)::integer FROM recharge_orders WHERE status = 'paid') AS paid_orders,
        (SELECT COUNT(DISTINCT user_id)::integer FROM recharge_orders WHERE status IN ('paid', 'refunded')) AS paid_users,
        (SELECT COALESCE(SUM(amount_cents), 0)::integer FROM recharge_orders WHERE status IN ('paid', 'refunded')) AS gross_revenue_cents,
        (SELECT COUNT(*)::integer FROM recharge_orders WHERE status = 'refunded') AS refunded_orders,
        (SELECT COALESCE(SUM(amount_cents), 0)::integer FROM recharge_orders WHERE status = 'refunded') AS refunded_cents,
        (SELECT COUNT(*)::integer FROM order_support_requests WHERE status IN ('open', 'reviewing')) AS open_support_requests
    `),
    db.query<TrendRow>(`
      WITH days AS (
        SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
      ), registrations AS (
        SELECT "createdAt"::date AS day, COUNT(*)::integer AS count FROM "user"
        WHERE "createdAt" >= CURRENT_DATE - INTERVAL '29 days' GROUP BY 1
      ), review_activity AS (
        SELECT created_at::date AS day, COUNT(*)::integer AS reviews,
               COUNT(DISTINCT user_id)::integer AS active_users
        FROM writing_reviews WHERE created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY 1
      ), orders AS (
        SELECT created_at::date AS day, COUNT(*)::integer AS paid_orders,
               COALESCE(SUM(amount_cents), 0)::integer AS revenue_cents
        FROM recharge_orders
        WHERE status IN ('paid', 'refunded') AND created_at >= CURRENT_DATE - INTERVAL '29 days' GROUP BY 1
      )
      SELECT d.day, COALESCE(r.count, 0)::integer AS registrations,
             COALESCE(a.active_users, 0)::integer AS active_users,
             COALESCE(a.reviews, 0)::integer AS reviews,
             COALESCE(o.paid_orders, 0)::integer AS paid_orders,
             COALESCE(o.revenue_cents, 0)::integer AS revenue_cents
      FROM days d
      LEFT JOIN registrations r USING (day)
      LEFT JOIN review_activity a USING (day)
      LEFT JOIN orders o USING (day)
      ORDER BY d.day
    `),
    db.query<PlanRow>(`
      SELECT product_code, product_name, COUNT(*)::integer AS order_count,
             COALESCE(SUM(amount_cents), 0)::integer AS revenue_cents
      FROM recharge_orders
      WHERE status IN ('paid', 'refunded')
      GROUP BY product_code, product_name
      ORDER BY order_count DESC, revenue_cents DESC
    `),
    db.query<RecentUserRow>(`
      SELECT u.id, u.name, u.email, u."emailVerified" AS email_verified,
             u."createdAt" AS created_at,
             COUNT(DISTINCT r.id)::integer AS review_count,
             MAX(r.created_at) AS last_review_at,
             COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('paid', 'refunded'))::integer AS paid_order_count
      FROM "user" u
      LEFT JOIN writing_reviews r ON r.user_id = u.id
      LEFT JOIN recharge_orders o ON o.user_id = u.id
      GROUP BY u.id, u.name, u.email, u."emailVerified", u."createdAt"
      ORDER BY u."createdAt" DESC
      LIMIT 10
    `),
    db.query<RecentReviewRow>(`
      SELECT r.id, r.user_id, u.name AS user_name, u.email AS user_email,
             r.task_type, r.status, r.estimated_band, r.word_count,
             r.provider_used, r.created_at
      FROM writing_reviews r
      LEFT JOIN "user" u ON u.id = r.user_id
      ORDER BY r.created_at DESC
      LIMIT 10
    `)
  ]);

  const row = summaryResult.rows[0];
  const registeredUsers = Number(row.registered_users);
  const paidUsers = Number(row.paid_users);
  const reviews7d = Number(row.reviews_7d);
  const completedReviews7d = Number(row.completed_reviews_7d);
  const grossRevenueCents = Number(row.gross_revenue_cents);
  const refundedCents = Number(row.refunded_cents);

  return {
    generatedAt: new Date().toISOString(),
    definitions: {
      activeUser: "统计周期内至少提交过一次作文批改的注册用户，按用户去重。",
      revenue: "模拟支付订单的累计流水；净收入已扣除标记为退款的订单。"
    },
    summary: {
      registeredUsers,
      newUsers7d: Number(row.new_users_7d),
      activeUsers7d: Number(row.active_users_7d),
      activeUsers30d: Number(row.active_users_30d),
      totalReviews: Number(row.total_reviews),
      reviews7d,
      reviewCompletionRate7d: reviews7d > 0 ? completedReviews7d / reviews7d : 0,
      paidOrders: Number(row.paid_orders),
      paidUsers,
      paidConversionRate: registeredUsers > 0 ? paidUsers / registeredUsers : 0,
      grossRevenueCents,
      refundedOrders: Number(row.refunded_orders),
      refundedCents,
      netRevenueCents: grossRevenueCents - refundedCents,
      openSupportRequests: Number(row.open_support_requests)
    },
    trend: trendResult.rows.map((item) => ({
      date: new Date(item.day).toISOString().slice(0, 10),
      registrations: Number(item.registrations),
      activeUsers: Number(item.active_users),
      reviews: Number(item.reviews),
      paidOrders: Number(item.paid_orders),
      revenueCents: Number(item.revenue_cents)
    })),
    planMix: planResult.rows.map((item) => ({
      productCode: item.product_code,
      productName: item.product_name,
      orderCount: Number(item.order_count),
      revenueCents: Number(item.revenue_cents)
    })),
    recentUsers: recentUsersResult.rows.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      emailVerified: Boolean(item.email_verified),
      createdAt: new Date(item.created_at).toISOString(),
      reviewCount: Number(item.review_count),
      lastReviewAt: item.last_review_at ? new Date(item.last_review_at).toISOString() : null,
      paidOrderCount: Number(item.paid_order_count)
    })),
    recentReviews: recentReviewsResult.rows.map((item) => ({
      id: item.id,
      userId: item.user_id,
      userName: item.user_name,
      userEmail: item.user_email,
      taskType: item.task_type,
      status: item.status,
      estimatedBand: item.estimated_band === null ? null : Number(item.estimated_band),
      wordCount: Number(item.word_count),
      providerUsed: item.provider_used,
      createdAt: new Date(item.created_at).toISOString()
    }))
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;

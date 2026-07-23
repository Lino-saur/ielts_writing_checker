"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import type { AdminDashboardData } from "@/lib/admin/dashboard";
import styles from "./admin-dashboard.module.css";

type ActivityTab = "users" | "reviews";

function integer(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency", currency: "CNY", maximumFractionDigits: 0
  }).format((cents || 0) / 100);
}

function percent(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(value || 0);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

function reviewStatus(status: string) {
  if (status === "completed") return "已完成";
  if (status === "processing") return "处理中";
  if (status === "failed") return "失败";
  if (status === "pending") return "等待中";
  return status;
}

export function AdminDashboardClient({ initialData }: { initialData: AdminDashboardData }) {
  const [data, setData] = useState(initialData);
  const [activityTab, setActivityTab] = useState<ActivityTab>("users");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = data.summary;

  // Keep the dashboard usable across hot updates when an older server payload is
  // missing a newly added collection.
  const trend = Array.isArray(data.trend) ? data.trend : [];
  const recentUsers = Array.isArray(data.recentUsers) ? data.recentUsers : [];
  const recentReviews = Array.isArray(data.recentReviews) ? data.recentReviews : [];
  const planMix = Array.isArray(data.planMix) ? data.planMix : [];
  const totalPlanOrders = planMix.reduce((sum, item) => sum + item.orderCount, 0);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const next = (await response.json()) as AdminDashboardData & { error?: string };
      if (!response.ok) throw new Error(next.error || "REQUEST_FAILED");
      setData(next);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "REQUEST_FAILED");
    } finally {
      setRefreshing(false);
    }
  }

  const primaryCards = [
    { label: "注册用户", value: integer(summary.registeredUsers), note: `近 7 天新增 ${integer(summary.newUsers7d)}` },
    { label: "7 日活跃", value: integer(summary.activeUsers7d), note: `30 日活跃 ${integer(summary.activeUsers30d)}` },
    { label: "7 日批改", value: integer(summary.reviews7d), note: `完成率 ${percent(summary.reviewCompletionRate7d)}` },
    { label: "模拟净收入", value: money(summary.netRevenueCents), note: `累计流水 ${money(summary.grossRevenueCents)}` }
  ];

  const secondaryMetrics = [
    { label: "累计付费订单", value: integer(summary.paidOrders), note: `${integer(summary.paidUsers)} 位付费用户` },
    { label: "付费转化率", value: percent(summary.paidConversionRate), note: "付费用户 / 注册用户" },
    { label: "已退款", value: integer(summary.refundedOrders), note: money(summary.refundedCents) },
    { label: "待处理售后", value: integer(summary.openSupportRequests), note: "订单疑问与退款申请", href: "/admin/order-support" }
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>运营概览</span>
          <h1>今天需要关注什么？</h1>
          <p>用户增长、产品使用、交易和售后情况汇总。</p>
        </div>
        <div className={styles.freshness}>
          <span>更新于 {new Date(data.generatedAt).toLocaleString("zh-CN")}</span>
          <button type="button" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "刷新中…" : "刷新数据"}
          </button>
        </div>
      </header>

      {error ? <div className={styles.error}>刷新失败：{error}</div> : null}

      <section className={styles.cardGrid} aria-label="核心指标">
        {primaryCards.map((card) => (
          <article className={styles.metricCard} key={card.label}>
            <span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small>
          </article>
        ))}
      </section>

      <section className={styles.secondaryMetrics} aria-label="辅助指标">
        {secondaryMetrics.map((metric) => (
          <article key={metric.label}>
            <div><span>{metric.label}</span><small>{metric.note}</small></div>
            {metric.href ? <Link href={metric.href}>{metric.value} <i>→</i></Link> : <strong>{metric.value}</strong>}
          </article>
        ))}
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>用户与批改趋势</h2><p>最近 30 个自然日</p></div></div>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(label) => shortDate(String(label))} />
                <Line type="monotone" dataKey="activeUsers" name="活跃用户" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="registrations" name="新增注册" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reviews" name="批改次数" stroke="#ea580c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>订单与流水趋势</h2><p>订单数与金额使用独立坐标轴</p></div></div>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis yAxisId="orders" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="revenue" orientation="right" tickFormatter={(value) => `¥${Math.round(Number(value) / 100)}`} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(label) => shortDate(String(label))} formatter={(value, name) => name === "模拟流水" ? money(Number(value)) : integer(Number(value))} />
                <Bar yAxisId="orders" dataKey="paidOrders" name="订单数" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="revenue" dataKey="revenueCents" name="模拟流水" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className={`${styles.panel} ${styles.activityPanel}`}>
        <div className={styles.panelHeader}>
          <div><h2>最新动态</h2><p>快速了解新用户与最近批改</p></div>
          <div className={styles.tabs} role="tablist" aria-label="最新动态类型">
            <button type="button" role="tab" aria-selected={activityTab === "users"} onClick={() => setActivityTab("users")}>新用户 <span>{recentUsers.length}</span></button>
            <button type="button" role="tab" aria-selected={activityTab === "reviews"} onClick={() => setActivityTab("reviews")}>最近批改 <span>{recentReviews.length}</span></button>
          </div>
        </div>

        {activityTab === "users" ? (
          recentUsers.length === 0 ? <div className={styles.empty}>暂无用户</div> : (
            <div className={styles.tableWrap}><table className={styles.recentTable}>
              <thead><tr><th>用户</th><th>注册时间</th><th>批改次数</th><th>付费订单</th></tr></thead>
              <tbody>{recentUsers.map((user) => (
                <tr key={user.id}>
                  <td><div className={styles.identity}><strong>{user.name?.trim() || "未设置昵称"}</strong><span>{user.email}</span><small>{user.emailVerified ? "邮箱已验证" : "邮箱未验证"}</small></div></td>
                  <td>{dateTime(user.createdAt)}</td>
                  <td><strong>{integer(user.reviewCount)}</strong>{user.lastReviewAt ? <small className={styles.subline}>最近 {dateTime(user.lastReviewAt)}</small> : null}</td>
                  <td>{integer(user.paidOrderCount)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )
        ) : (
          recentReviews.length === 0 ? <div className={styles.empty}>暂无批改记录</div> : (
            <div className={styles.tableWrap}><table className={styles.recentTable}>
              <thead><tr><th>用户</th><th>任务</th><th>状态</th><th>分数</th><th>提交时间</th></tr></thead>
              <tbody>{recentReviews.map((review) => (
                <tr key={review.id}>
                  <td><div className={styles.identity}><strong>{review.userName?.trim() || review.userEmail || "未知用户"}</strong>{review.userName?.trim() && review.userEmail ? <span>{review.userEmail}</span> : null}</div></td>
                  <td><strong>{review.taskType === "task1" ? "Task 1" : "Task 2"}</strong><small className={styles.subline}>{integer(review.wordCount)} 词 · {review.providerUsed}</small></td>
                  <td><span className={`${styles.status} ${styles[`status_${review.status}`] || ""}`}>{reviewStatus(review.status)}</span></td>
                  <td>{review.estimatedBand === null ? "—" : review.estimatedBand.toFixed(1)}</td>
                  <td>{dateTime(review.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )
        )}
      </section>

      <details className={styles.detailsPanel}>
        <summary><span><strong>更多经营数据</strong><small>套餐销售结构与指标口径</small></span><i>展开</i></summary>
        <div className={styles.detailsContent}>
          <h2>套餐销售结构</h2>
          {planMix.length === 0 ? <div className={styles.empty}>暂无订单数据</div> : (
            <div className={styles.tableWrap}><table><thead><tr><th>套餐</th><th>订单数</th><th>流水</th><th>订单占比</th></tr></thead><tbody>
              {planMix.map((plan) => (
                <tr key={plan.productCode}><td>{plan.productName}</td><td>{integer(plan.orderCount)}</td><td>{money(plan.revenueCents)}</td><td>{percent(totalPlanOrders ? plan.orderCount / totalPlanOrders : 0)}</td></tr>
              ))}
            </tbody></table></div>
          )}
          <footer className={styles.definitions}>
            <strong>指标口径</strong>
            <span>活跃用户：{data.definitions?.activeUser || "统计周期内至少提交一次批改的注册用户。"}</span>
            <span>收入：{data.definitions?.revenue || "模拟支付订单流水，净收入扣除已退款订单。"}</span>
          </footer>
        </div>
      </details>
    </main>
  );
}

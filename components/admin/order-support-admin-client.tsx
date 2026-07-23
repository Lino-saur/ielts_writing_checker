"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderSupportRequest, RechargeOrderStatus } from "@/lib/types";
import styles from "./order-support-admin.module.css";

type AdminItem = OrderSupportRequest & {
  order: {
    productName: string;
    amountCents: number;
    currency: string;
    status: RechargeOrderStatus;
    totalEnergyAmount: number;
    unlimitedDays: number | null;
  };
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "待处理",
  reviewing: "处理中",
  approved: "已解决",
  rejected: "已拒绝",
  refunded: "已退款"
};

export function OrderSupportAdminClient() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/order-support", { cache: "no-store" });
      const data = (await response.json()) as { items?: AdminItem[]; error?: string };
      if (!response.ok || !data.items) throw new Error(data.error || "REQUEST_FAILED");
      setItems(data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function act(item: AdminItem, action: "review" | "reject" | "resolve" | "refund") {
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/order-support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: item.id, action, adminNote: notes[item.id] || "" })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "REQUEST_FAILED");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "REQUEST_FAILED");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><span>交易售后</span><h1>订单与退款</h1><p>处理订单疑问和模拟退款申请。</p></div>
        <button type="button" onClick={() => void load()} disabled={loading}>刷新</button>
      </header>
      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.empty}>正在加载售后申请…</div> : items.length === 0 ? <div className={styles.empty}>暂无售后申请。</div> : (
        <div className={styles.list}>
          {items.map((item) => (
            <article className={styles.card} key={item.id}>
              <div className={styles.titleRow}>
                <div><strong>{item.kind === "refund" ? "退款申请" : "订单疑问"}</strong><span>{REQUEST_STATUS_LABELS[item.status] || item.status}</span></div>
                <b>{new Intl.NumberFormat("zh-CN", { style: "currency", currency: item.order.currency }).format(item.order.amountCents / 100)}</b>
              </div>
              <dl>
                <div><dt>订单 ID</dt><dd>{item.orderId}</dd></div>
                <div><dt>用户 ID</dt><dd>{item.userId}</dd></div>
                <div><dt>套餐</dt><dd>{item.order.unlimitedDays ? `${item.order.unlimitedDays} 天不限次` : `${item.order.totalEnergyAmount} 瓶墨水`}</dd></div>
                <div><dt>提交时间</dt><dd>{new Date(item.createdAt).toLocaleString("zh-CN")}</dd></div>
              </dl>
              <div className={styles.message}><strong>{item.reason}</strong>{item.details ? <p>{item.details}</p> : null}</div>
              {item.adminNote ? <p className={styles.previousNote}>后台备注：{item.adminNote}</p> : null}
              {item.status !== "refunded" && item.status !== "rejected" && item.status !== "approved" ? (
                <div className={styles.actions}>
                  <textarea value={notes[item.id] || ""} onChange={(event) => setNotes((value) => ({ ...value, [item.id]: event.target.value }))} placeholder="后台备注（选填）" />
                  <div>
                    <button type="button" onClick={() => void act(item, "review")} disabled={busyId === item.id}>标记处理中</button>
                    <button type="button" onClick={() => void act(item, "reject")} disabled={busyId === item.id}>拒绝</button>
                    {item.kind === "inquiry" ? (
                      <button type="button" className={styles.primary} onClick={() => void act(item, "resolve")} disabled={busyId === item.id}>解决</button>
                    ) : (
                      <button type="button" className={styles.primary} onClick={() => void act(item, "refund")} disabled={busyId === item.id}>模拟退款</button>
                    )}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

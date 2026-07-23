"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminSupportFilters } from "@/lib/admin/support";
import type { SupportInboxEntry, SupportInboxStatus } from "@/lib/types";
import styles from "./support-inbox.module.css";

type SupportInboxProps = {
  filters: AdminSupportFilters;
  items: SupportInboxEntry[];
  stats: {
    total: number;
    newCount: number;
    reviewingCount: number;
    closedCount: number;
  };
};

const STATUS_LABELS: Record<SupportInboxStatus, string> = {
  new: "待处理",
  reviewing: "处理中",
  closed: "已关闭"
};

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getStatusClassName(status: SupportInboxStatus) {
  if (status === "new") return styles.tagStatusNew;
  if (status === "reviewing") return styles.tagStatusReviewing;
  return styles.tagStatusClosed;
}

function getBodyPreview(item: SupportInboxEntry) {
  const value = item.textContent.trim() || displaySubject(item.subject);
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

function displaySubject(subject: string) {
  return subject.trim() === "(no subject)" ? "无主题" : subject;
}

function normalizeReplySubject(subject: string) {
  return subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}

export function SupportInbox({ filters, items, stats }: SupportInboxProps) {
  const [replyBodyById, setReplyBodyById] = useState<Record<string, string>>({});
  const [sendingEntryId, setSendingEntryId] = useState<string | null>(null);
  const [successEntryId, setSuccessEntryId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});

  async function handleSendReply(entryId: string) {
    const message = (replyBodyById[entryId] || "").trim();
    if (!message) {
      setErrorById((current) => ({ ...current, [entryId]: "回复内容不能为空。" }));
      return;
    }

    setSendingEntryId(entryId);
    setSuccessEntryId(null);
    setErrorById((current) => ({ ...current, [entryId]: null }));

    try {
      const response = await fetch("/api/admin/support/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entryId,
          message
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "REQUEST_FAILED");
      }

      setReplyBodyById((current) => ({ ...current, [entryId]: "" }));
      setSuccessEntryId(entryId);
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [entryId]: error instanceof Error ? error.message : "REQUEST_FAILED"
      }));
    } finally {
      setSendingEntryId(null);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <p className={styles.eyebrow}>邮件客服</p>
          <h1>客服工单</h1>
          <p className={styles.lead}>查看用户来信、保留邮件上下文，并直接从后台回复。</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.actionLink} href="/">
            返回前台
          </Link>
          <Link className={`${styles.actionLink} ${styles.actionLinkSecondary}`} href="/admin/support">
            重置筛选
          </Link>
        </div>
      </div>

      <div className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>全部</span>
          <strong>{stats.total}</strong>
          <p>已收到的全部客服邮件。</p>
        </article>
        <article className={styles.statCard}>
          <span>待处理</span>
          <strong>{stats.newCount}</strong>
          <p>尚未开始处理的工单。</p>
        </article>
        <article className={styles.statCard}>
          <span>处理中</span>
          <strong>{stats.reviewingCount}</strong>
          <p>已经开始跟进的工单。</p>
        </article>
        <article className={styles.statCard}>
          <span>已关闭</span>
          <strong>{stats.closedCount}</strong>
          <p>已经解决或归档的工单。</p>
        </article>
      </div>

      <form className={styles.filterBar} method="get">
        <label className={styles.filterLabel}>
          <span>状态</span>
          <select className={styles.filterControl} name="status" defaultValue={filters.status}>
            <option value="all">全部</option>
            <option value="new">待处理</option>
            <option value="reviewing">处理中</option>
            <option value="closed">已关闭</option>
          </select>
        </label>

        <label className={styles.filterLabel}>
          <span>搜索</span>
          <input className={styles.filterControl} name="q" defaultValue={filters.q} placeholder="搜索发件人、主题或正文" />
        </label>

        <button className={styles.filterButton} type="submit">
          应用筛选
        </button>
      </form>

      <div className={styles.summary}>
        <span>共 {items.length} 条</span>
        <span className={styles.hint}>客服来信由 Resend 入站 webhook 自动收取。</span>
      </div>

      <div className={styles.list}>
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.subjectRow}>
                    <strong>{displaySubject(item.subject)}</strong>
                    <span className={`${styles.tag} ${getStatusClassName(item.status)}`}>{STATUS_LABELS[item.status]}</span>
                  </div>
                  <div className={styles.meta}>
                    <span>{item.fromName ? `${item.fromName} <${item.fromEmail}>` : item.fromEmail}</span>
                    <span>{item.toEmail || "未识别收件地址"}</span>
                    <span>{formatDate(item.receivedAt)}</span>
                  </div>
                </div>
                <div className={styles.replyMeta}>
                  <span>已回复 {item.replyCount} 次</span>
                  <span>最近回复 {formatDate(item.lastRepliedAt)}</span>
                </div>
              </div>

              <p className={styles.preview}>{getBodyPreview(item)}</p>

              <details className={styles.details}>
                <summary>查看完整邮件</summary>
                <pre>{item.textContent || "无纯文本正文"}</pre>
                {Object.keys(item.rawPayload).length ? (
                  <details className={styles.rawPayload}>
                    <summary>原始数据</summary>
                    <pre>{JSON.stringify(item.rawPayload, null, 2)}</pre>
                  </details>
                ) : null}
              </details>

              <div className={styles.replyBox}>
                <div className={styles.replyHeader}>
                  <strong>{normalizeReplySubject(displaySubject(item.subject))}</strong>
                  <span>{item.fromEmail}</span>
                </div>
                <textarea
                  className={styles.replyInput}
                  rows={5}
                  value={replyBodyById[item.id] || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReplyBodyById((current) => ({ ...current, [item.id]: value }));
                  }}
                  placeholder="输入回复内容…"
                />
                {errorById[item.id] ? <div className={styles.error}>{errorById[item.id]}</div> : null}
                {successEntryId === item.id ? <div className={styles.success}>回复已发送。</div> : null}
                <div className={styles.replyActions}>
                  <button
                    type="button"
                    className={styles.replyButton}
                    disabled={sendingEntryId === item.id}
                    onClick={() => void handleSendReply(item.id)}
                  >
                    {sendingEntryId === item.id ? "发送中…" : "发送回复"}
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className={styles.empty}>暂时没有客服来信。</div>
        )}
      </div>
    </section>
  );
}

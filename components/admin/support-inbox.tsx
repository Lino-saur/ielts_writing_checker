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
  new: "New",
  reviewing: "Reviewing",
  closed: "Closed"
};

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
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
  const value = item.textContent.trim() || item.subject.trim();
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
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
      setErrorById((current) => ({ ...current, [entryId]: "Reply cannot be empty." }));
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
          <p className={styles.eyebrow}>Resend inbound surface</p>
          <h1>Support Inbox</h1>
          <p className={styles.lead}>Review inbound support emails, keep message context, and reply from the admin workspace.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.actionLink} href="/">
            Back to app
          </Link>
          <Link className={`${styles.actionLink} ${styles.actionLinkSecondary}`} href="/admin/support">
            Reset filters
          </Link>
        </div>
      </div>

      <div className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>Total</span>
          <strong>{stats.total}</strong>
          <p>All received support emails.</p>
        </article>
        <article className={styles.statCard}>
          <span>New</span>
          <strong>{stats.newCount}</strong>
          <p>Items that still need a first pass.</p>
        </article>
        <article className={styles.statCard}>
          <span>Reviewing</span>
          <strong>{stats.reviewingCount}</strong>
          <p>Threads that already have activity.</p>
        </article>
        <article className={styles.statCard}>
          <span>Closed</span>
          <strong>{stats.closedCount}</strong>
          <p>Resolved or archived items.</p>
        </article>
      </div>

      <form className={styles.filterBar} method="get">
        <label className={styles.filterLabel}>
          <span>Status</span>
          <select className={styles.filterControl} name="status" defaultValue={filters.status}>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="reviewing">Reviewing</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className={styles.filterLabel}>
          <span>Search</span>
          <input className={styles.filterControl} name="q" defaultValue={filters.q} placeholder="Search sender, subject, body" />
        </label>

        <button className={styles.filterButton} type="submit">
          Apply
        </button>
      </form>

      <div className={styles.summary}>
        <span>{items.length} item(s)</span>
        <span className={styles.hint}>Configure Resend inbound webhook to start filling this inbox.</span>
      </div>

      <div className={styles.list}>
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.subjectRow}>
                    <strong>{item.subject}</strong>
                    <span className={`${styles.tag} ${getStatusClassName(item.status)}`}>{STATUS_LABELS[item.status]}</span>
                  </div>
                  <div className={styles.meta}>
                    <span>{item.fromName ? `${item.fromName} <${item.fromEmail}>` : item.fromEmail}</span>
                    <span>{item.toEmail || "(no recipient)"}</span>
                    <span>{formatDate(item.receivedAt)}</span>
                  </div>
                </div>
                <div className={styles.replyMeta}>
                  <span>Replies {item.replyCount}</span>
                  <span>Last reply {formatDate(item.lastRepliedAt)}</span>
                </div>
              </div>

              <p className={styles.preview}>{getBodyPreview(item)}</p>

              <details className={styles.details}>
                <summary>Open message</summary>
                <pre>{item.textContent || "(no text body)"}</pre>
                {Object.keys(item.rawPayload).length ? (
                  <details className={styles.rawPayload}>
                    <summary>Raw payload</summary>
                    <pre>{JSON.stringify(item.rawPayload, null, 2)}</pre>
                  </details>
                ) : null}
              </details>

              <div className={styles.replyBox}>
                <div className={styles.replyHeader}>
                  <strong>{normalizeReplySubject(item.subject)}</strong>
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
                  placeholder="Write a reply from the admin workspace..."
                />
                {errorById[item.id] ? <div className={styles.error}>{errorById[item.id]}</div> : null}
                {successEntryId === item.id ? <div className={styles.success}>Reply sent.</div> : null}
                <div className={styles.replyActions}>
                  <button
                    type="button"
                    className={styles.replyButton}
                    disabled={sendingEntryId === item.id}
                    onClick={() => void handleSendReply(item.id)}
                  >
                    {sendingEntryId === item.id ? "Sending..." : "Send reply"}
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className={styles.empty}>No inbound support emails yet.</div>
        )}
      </div>
    </section>
  );
}

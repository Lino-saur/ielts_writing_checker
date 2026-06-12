import Link from "next/link";
import type { FeedbackEntry, FeedbackStatus } from "@/lib/types";
import type { AdminFeedbackFilters } from "@/lib/admin/feedback";
import styles from "./feedback-inbox.module.css";

type FeedbackInboxProps = {
  filters: AdminFeedbackFilters;
  items: FeedbackEntry[];
  stats: {
    total: number;
    newCount: number;
    bugCount: number;
    reviewCount: number;
  };
};

const KIND_LABELS: Record<FeedbackEntry["kind"], string> = {
  review: "Review",
  product: "Product",
  bug: "Bug",
  feature_request: "Feature request"
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  closed: "Closed"
};

function formatHelpful(helpful: boolean | null) {
  if (helpful === true) {
    return "Helpful";
  }

  if (helpful === false) {
    return "Not helpful";
  }

  return "Unrated";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getKindClassName(kind: FeedbackEntry["kind"]) {
  if (kind === "review") return styles.tagKindReview;
  if (kind === "product") return styles.tagKindProduct;
  if (kind === "bug") return styles.tagKindBug;
  return styles.tagKindFeatureRequest;
}

function getStatusClassName(status: FeedbackStatus) {
  if (status === "new") return styles.tagStatusNew;
  if (status === "reviewing") return styles.tagStatusReviewing;
  return styles.tagStatusClosed;
}

export function FeedbackInbox({ filters, items, stats }: FeedbackInboxProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <p className={styles.eyebrow}>Hyper-style admin surface</p>
          <h1>Feedback Inbox</h1>
          <p className={styles.lead}>Review product feedback and scoring feedback in one place.</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.actionLink} href="/">
            Back to app
          </Link>
          <Link className={`${styles.actionLink} ${styles.actionLinkSecondary}`} href="/admin/feedback">
            Reset filters
          </Link>
        </div>
      </div>

      <div className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>Total</span>
          <strong>{stats.total}</strong>
          <p>All matched feedback entries.</p>
        </article>
        <article className={styles.statCard}>
          <span>New</span>
          <strong>{stats.newCount}</strong>
          <p>Fresh items that still need triage.</p>
        </article>
        <article className={styles.statCard}>
          <span>Bug</span>
          <strong>{stats.bugCount}</strong>
          <p>Potential defects reported by users.</p>
        </article>
        <article className={styles.statCard}>
          <span>Review</span>
          <strong>{stats.reviewCount}</strong>
          <p>Feedback tied to a single scoring result.</p>
        </article>
      </div>

      <form className={styles.filterBar} method="get">
        <label className={styles.filterLabel}>
          <span>Kind</span>
          <select className={styles.filterControl} name="kind" defaultValue={filters.kind}>
            <option value="all">All</option>
            <option value="review">Review</option>
            <option value="product">Product</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature request</option>
          </select>
        </label>

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
          <span>Helpful</span>
          <select className={styles.filterControl} name="helpful" defaultValue={filters.helpful}>
            <option value="all">All</option>
            <option value="helpful">Helpful</option>
            <option value="not_helpful">Not helpful</option>
            <option value="unrated">Unrated</option>
          </select>
        </label>

        <label className={styles.filterLabel}>
          <span>Search</span>
          <input className={styles.filterControl} name="q" defaultValue={filters.q} placeholder="Search comment, page, user id" />
        </label>

        <button className={styles.filterButton} type="submit">
          Apply
        </button>
      </form>

      <div className={styles.summary}>
        <span>{items.length} item(s)</span>
      </div>

      <div className={styles.list}>
        {items.length ? (
          <div className={styles.listHead}>
            <span>Type</span>
            <span>User</span>
            <span>Email</span>
            <span>Message</span>
            <span>Signals</span>
            <span>Created</span>
          </div>
        ) : null}

        {items.length ? (
          items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.type}>
                <span className={`${styles.tag} ${getKindClassName(item.kind)}`}>{KIND_LABELS[item.kind]}</span>
                <span className={`${styles.tag} ${getStatusClassName(item.status)}`}>{STATUS_LABELS[item.status]}</span>
              </div>

              <div className={styles.user}>
                <strong>{item.userName || "(no name)"}</strong>
                <span>{item.userId}</span>
              </div>

              <div className={styles.email}>{item.userEmail || "(no email)"}</div>

              <div className={styles.body}>
                <div className={styles.headline}>
                  <strong>{item.page}</strong>
                </div>
                <p className={styles.comment}>{item.comment || "(empty)"}</p>
              </div>

              <div className={styles.signals}>
                <span className={`${styles.tag} ${styles.tagNeutral}`}>{formatHelpful(item.helpful)}</span>
                {item.taskType ? <span className={`${styles.tag} ${styles.tagNeutral}`}>{item.taskType}</span> : null}
                <span className={styles.signal}>Band {item.estimatedBand ?? "--"}</span>
                <span className={styles.signal}>Target {item.targetBand ?? "--"}</span>
                <span className={styles.signal}>{item.providerUsed ?? "--"}</span>
              </div>

              <div className={styles.created}>{formatDate(item.createdAt)}</div>

              {Object.keys(item.payload).length ? (
                <details className={styles.payload}>
                  <summary>Context payload</summary>
                  <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                </details>
              ) : null}
            </article>
          ))
        ) : (
          <div className={styles.empty}>No feedback matched the current filters.</div>
        )}
      </div>
    </section>
  );
}

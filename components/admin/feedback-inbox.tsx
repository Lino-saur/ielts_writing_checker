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
  review: "批改反馈",
  product: "产品意见",
  bug: "问题反馈",
  feature_request: "功能建议"
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "待处理",
  reviewing: "处理中",
  closed: "已关闭"
};

function formatHelpful(helpful: boolean | null) {
  if (helpful === true) {
    return "有帮助";
  }

  if (helpful === false) {
    return "没帮助";
  }

  return "未评价";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
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
          <p className={styles.eyebrow}>用户声音</p>
          <h1>用户反馈</h1>
          <p className={styles.lead}>集中查看产品意见、问题反馈和批改评价。</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.actionLink} href="/">
            返回前台
          </Link>
          <Link className={`${styles.actionLink} ${styles.actionLinkSecondary}`} href="/admin/feedback">
            重置筛选
          </Link>
        </div>
      </div>

      <div className={styles.statGrid}>
        <article className={styles.statCard}>
          <span>全部</span>
          <strong>{stats.total}</strong>
          <p>当前筛选下的反馈总数。</p>
        </article>
        <article className={styles.statCard}>
          <span>待处理</span>
          <strong>{stats.newCount}</strong>
          <p>尚未开始处理的反馈。</p>
        </article>
        <article className={styles.statCard}>
          <span>问题反馈</span>
          <strong>{stats.bugCount}</strong>
          <p>用户提交的产品问题。</p>
        </article>
        <article className={styles.statCard}>
          <span>批改反馈</span>
          <strong>{stats.reviewCount}</strong>
          <p>针对某次作文批改的评价。</p>
        </article>
      </div>

      <form className={styles.filterBar} method="get">
        <label className={styles.filterLabel}>
          <span>类型</span>
          <select className={styles.filterControl} name="kind" defaultValue={filters.kind}>
            <option value="all">全部</option>
            <option value="review">批改反馈</option>
            <option value="product">产品意见</option>
            <option value="bug">问题反馈</option>
            <option value="feature_request">功能建议</option>
          </select>
        </label>

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
          <span>是否有帮助</span>
          <select className={styles.filterControl} name="helpful" defaultValue={filters.helpful}>
            <option value="all">全部</option>
            <option value="helpful">有帮助</option>
            <option value="not_helpful">没帮助</option>
            <option value="unrated">未评价</option>
          </select>
        </label>

        <label className={styles.filterLabel}>
          <span>搜索</span>
          <input className={styles.filterControl} name="q" defaultValue={filters.q} placeholder="搜索反馈内容、页面或用户 ID" />
        </label>

        <button className={styles.filterButton} type="submit">
          应用筛选
        </button>
      </form>

      <div className={styles.summary}>
        <span>共 {items.length} 条</span>
      </div>

      <div className={styles.list}>
        {items.length ? (
          <div className={styles.listHead}>
            <span>类型</span>
            <span>用户</span>
            <span>邮箱</span>
            <span>反馈内容</span>
            <span>相关数据</span>
            <span>提交时间</span>
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
                <strong>{item.userName || "未设置昵称"}</strong>
                <span>{item.userId}</span>
              </div>

              <div className={styles.email}>{item.userEmail || "未提供邮箱"}</div>

              <div className={styles.body}>
                <div className={styles.headline}>
                  <strong>{item.page}</strong>
                </div>
                <p className={styles.comment}>{item.comment || "无文字内容"}</p>
              </div>

              <div className={styles.signals}>
                <span className={`${styles.tag} ${styles.tagNeutral}`}>{formatHelpful(item.helpful)}</span>
                {item.taskType ? <span className={`${styles.tag} ${styles.tagNeutral}`}>{item.taskType}</span> : null}
                <span className={styles.signal}>评分 {item.estimatedBand ?? "--"}</span>
                <span className={styles.signal}>目标 {item.targetBand ?? "--"}</span>
                <span className={styles.signal}>{item.providerUsed ?? "--"}</span>
              </div>

              <div className={styles.created}>{formatDate(item.createdAt)}</div>

              {Object.keys(item.payload).length ? (
                <details className={styles.payload}>
                  <summary>查看上下文数据</summary>
                  <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                </details>
              ) : null}
            </article>
          ))
        ) : (
          <div className={styles.empty}>当前筛选条件下没有反馈。</div>
        )}
      </div>
    </section>
  );
}

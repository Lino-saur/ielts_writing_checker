"use client";

import { useEffect, useState } from "react";
import type { AdminFeedbackFilters } from "@/lib/admin/feedback";
import type { FeedbackEntry } from "@/lib/types";
import { FeedbackInbox } from "./feedback-inbox";
import styles from "./feedback-inbox.module.css";

type FeedbackInboxClientProps = {
  filters: AdminFeedbackFilters;
};

type FeedbackInboxResponse = {
  items: FeedbackEntry[];
  stats: {
    total: number;
    newCount: number;
    bugCount: number;
    reviewCount: number;
  };
};

function buildQueryString(filters: AdminFeedbackFilters) {
  const params = new URLSearchParams();
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.helpful !== "all") params.set("helpful", filters.helpful);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

export function FeedbackInboxClient({ filters }: FeedbackInboxClientProps) {
  const [data, setData] = useState<FeedbackInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/admin/feedback${query ? `?${query}` : ""}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as FeedbackInboxResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "REQUEST_FAILED");
        }

        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  if (loading) {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>正在加载用户反馈…</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>用户反馈加载失败。</div>
      </section>
    );
  }

  return <FeedbackInbox filters={filters} items={data.items} stats={data.stats} />;
}

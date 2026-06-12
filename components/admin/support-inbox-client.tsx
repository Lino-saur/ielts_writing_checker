"use client";

import { useEffect, useState } from "react";
import type { AdminSupportFilters } from "@/lib/admin/support";
import type { SupportInboxEntry } from "@/lib/types";
import { SupportInbox } from "./support-inbox";
import styles from "./support-inbox.module.css";

type SupportInboxClientProps = {
  filters: AdminSupportFilters;
};

type SupportInboxResponse = {
  items: SupportInboxEntry[];
  stats: {
    total: number;
    newCount: number;
    reviewingCount: number;
    closedCount: number;
  };
};

function buildQueryString(filters: AdminSupportFilters) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

export function SupportInboxClient({ filters }: SupportInboxClientProps) {
  const [data, setData] = useState<SupportInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/admin/support${query ? `?${query}` : ""}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as SupportInboxResponse & { error?: string };

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
        <div className={styles.empty}>Loading support inbox...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>Failed to load support inbox.</div>
      </section>
    );
  }

  return <SupportInbox filters={filters} items={data.items} stats={data.stats} />;
}

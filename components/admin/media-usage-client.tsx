"use client";

import { FormEvent, useEffect, useState } from "react";
import { ActionButton, Surface } from "@/components/ui-kit";
import styles from "./energy-grant.module.css";

type MonthUsage = {
  monthKey: string;
  uploadBytes: number;
  downloadBytes: number;
  uploadCount: number;
  downloadCount: number;
  updatedAt: string;
};

type QuotaSettings = {
  uploadLimitBytes: number | null;
  downloadLimitBytes: number | null;
  hardBlockUploads: boolean;
  hardBlockDownloads: boolean;
  updatedAt: string;
};

type DashboardPayload = {
  currentMonth: MonthUsage;
  recentMonths: MonthUsage[];
  settings: QuotaSettings;
};

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function bytesToGbString(value: number | null) {
  if (value == null) {
    return "";
  }

  return (value / (1024 * 1024 * 1024)).toFixed(2);
}

function getErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === "string" ? error : "REQUEST_FAILED";
  }

  return "REQUEST_FAILED";
}

export function MediaUsageClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [uploadLimitGb, setUploadLimitGb] = useState("");
  const [downloadLimitGb, setDownloadLimitGb] = useState("");
  const [hardBlockUploads, setHardBlockUploads] = useState(false);
  const [hardBlockDownloads, setHardBlockDownloads] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/media-usage", {
          cache: "no-store"
        });
        const payload = (await response.json()) as DashboardPayload | { error?: string };

        if (!response.ok || !("settings" in payload)) {
          throw new Error(getErrorMessage(payload));
        }

        if (!cancelled) {
          setDashboard(payload);
          setUploadLimitGb(bytesToGbString(payload.settings.uploadLimitBytes));
          setDownloadLimitGb(bytesToGbString(payload.settings.downloadLimitBytes));
          setHardBlockUploads(payload.settings.hardBlockUploads);
          setHardBlockDownloads(payload.settings.hardBlockDownloads);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/media-usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploadLimitGb: uploadLimitGb.trim() ? Number(uploadLimitGb) : null,
          downloadLimitGb: downloadLimitGb.trim() ? Number(downloadLimitGb) : null,
          hardBlockUploads,
          hardBlockDownloads
        })
      });
      const payload = (await response.json()) as { settings?: QuotaSettings; error?: string };

      if (!response.ok || !payload.settings) {
        throw new Error(getErrorMessage(payload));
      }

      const nextSettings = payload.settings;

      setDashboard((current) =>
        current
          ? {
              ...current,
              settings: nextSettings
            }
          : current
      );
      setSuccess("Quota settings updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "REQUEST_FAILED");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Surface className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Internal Ops</p>
          <h1 className={styles.title}>Manage media quota</h1>
          <p className={styles.body}>
            Control monthly image upload and delivery budget for Task 1 review assets. Uploads are blocked before new
            presigned URLs are issued. History image reads are blocked at the app proxy when download quota is reached.
          </p>
        </div>
      </Surface>

      <Surface className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Current month</h2>
            <p className={styles.sectionBody}>Track storage-related traffic that the app has accepted this month.</p>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>Loading usage metrics...</div>
        ) : dashboard ? (
          <div className={styles.resultList}>
            <div className={styles.resultCard}>
              <strong>{dashboard.currentMonth.monthKey}</strong>
              <span>Uploads: {formatBytes(dashboard.currentMonth.uploadBytes)}</span>
              <span>Downloads: {formatBytes(dashboard.currentMonth.downloadBytes)}</span>
              <span>Upload count: {dashboard.currentMonth.uploadCount}</span>
              <span>Download count: {dashboard.currentMonth.downloadCount}</span>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>No usage data yet.</div>
        )}
      </Surface>

      <Surface as="form" className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Quota policy</h2>
            <p className={styles.sectionBody}>Leave a field empty to disable that limit.</p>
          </div>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Monthly upload limit (GB)</span>
            <input value={uploadLimitGb} onChange={(event) => setUploadLimitGb(event.target.value)} placeholder="e.g. 10" />
          </label>

          <label className={styles.field}>
            <span>Monthly download limit (GB)</span>
            <input
              value={downloadLimitGb}
              onChange={(event) => setDownloadLimitGb(event.target.value)}
              placeholder="e.g. 50"
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>
            <input type="checkbox" checked={hardBlockUploads} onChange={(event) => setHardBlockUploads(event.target.checked)} />{" "}
            Hard block all new uploads
          </span>
        </label>

        <label className={styles.field}>
          <span>
            <input
              type="checkbox"
              checked={hardBlockDownloads}
              onChange={(event) => setHardBlockDownloads(event.target.checked)}
            />{" "}
            Hard block all image reads
          </span>
        </label>

        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.success}>{success}</div> : null}

        <div className={styles.actions}>
          <ActionButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save quota settings"}
          </ActionButton>
        </div>
      </Surface>

      <Surface className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Recent months</h2>
            <p className={styles.sectionBody}>Quick visibility into storage-heavy months.</p>
          </div>
        </div>

        <div className={styles.resultList}>
          {dashboard?.recentMonths.length ? (
            dashboard.recentMonths.map((item) => (
              <div key={item.monthKey} className={styles.resultCard}>
                <strong>{item.monthKey}</strong>
                <span>Uploads: {formatBytes(item.uploadBytes)}</span>
                <span>Downloads: {formatBytes(item.downloadBytes)}</span>
                <span>
                  Requests: {item.uploadCount} upload / {item.downloadCount} download
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>No prior month data yet.</div>
          )}
        </div>
      </Surface>
    </div>
  );
}

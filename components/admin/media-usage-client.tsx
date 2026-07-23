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
      setSuccess("额度设置已更新。");
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
          <p className={styles.eyebrow}>内部运营工具</p>
          <h1 className={styles.title}>媒体额度管理</h1>
          <p className={styles.body}>
            管理 Task 1 图片每月上传与下载额度。达到限制后，系统将停止签发新的上传地址或读取历史图片。
          </p>
        </div>
      </Surface>

      <Surface className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>本月使用情况</h2>
            <p className={styles.sectionBody}>查看本月图片上传、下载流量和请求次数。</p>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>正在加载用量数据…</div>
        ) : dashboard ? (
          <div className={styles.resultList}>
            <div className={styles.resultCard}>
              <strong>{dashboard.currentMonth.monthKey}</strong>
              <span>上传流量：{formatBytes(dashboard.currentMonth.uploadBytes)}</span>
              <span>下载流量：{formatBytes(dashboard.currentMonth.downloadBytes)}</span>
              <span>上传次数：{dashboard.currentMonth.uploadCount}</span>
              <span>下载次数：{dashboard.currentMonth.downloadCount}</span>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>暂无用量数据。</div>
        )}
      </Surface>

      <Surface as="form" className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>额度策略</h2>
            <p className={styles.sectionBody}>输入框留空表示不限制该项额度。</p>
          </div>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>每月上传上限（GB）</span>
            <input value={uploadLimitGb} onChange={(event) => setUploadLimitGb(event.target.value)} placeholder="例如：10" />
          </label>

          <label className={styles.field}>
            <span>每月下载上限（GB）</span>
            <input
              value={downloadLimitGb}
              onChange={(event) => setDownloadLimitGb(event.target.value)}
              placeholder="例如：50"
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>
            <input type="checkbox" checked={hardBlockUploads} onChange={(event) => setHardBlockUploads(event.target.checked)} />{" "}
            停止所有新图片上传
          </span>
        </label>

        <label className={styles.field}>
          <span>
            <input
              type="checkbox"
              checked={hardBlockDownloads}
              onChange={(event) => setHardBlockDownloads(event.target.checked)}
            />{" "}
            停止所有图片读取
          </span>
        </label>

        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.success}>{success}</div> : null}

        <div className={styles.actions}>
          <ActionButton type="submit" variant="primary" disabled={saving}>
            {saving ? "保存中…" : "保存额度设置"}
          </ActionButton>
        </div>
      </Surface>

      <Surface className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>历史月份</h2>
            <p className={styles.sectionBody}>查看近期各月媒体用量。</p>
          </div>
        </div>

        <div className={styles.resultList}>
          {dashboard?.recentMonths.length ? (
            dashboard.recentMonths.map((item) => (
              <div key={item.monthKey} className={styles.resultCard}>
                <strong>{item.monthKey}</strong>
                <span>上传流量：{formatBytes(item.uploadBytes)}</span>
                <span>下载流量：{formatBytes(item.downloadBytes)}</span>
                <span>
                  请求次数：上传 {item.uploadCount} 次 / 下载 {item.downloadCount} 次
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>暂无历史月份数据。</div>
          )}
        </div>
      </Surface>
    </div>
  );
}

import { db, ensureDatabase } from "@/lib/db";

export type MediaQuotaSettings = {
  uploadLimitBytes: number | null;
  downloadLimitBytes: number | null;
  hardBlockUploads: boolean;
  hardBlockDownloads: boolean;
  updatedAt: string;
};

export type MediaUsageMonth = {
  monthKey: string;
  uploadBytes: number;
  downloadBytes: number;
  uploadCount: number;
  downloadCount: number;
  updatedAt: string;
};

type MediaUsageRow = {
  month_key: string;
  upload_bytes: string | number;
  download_bytes: string | number;
  upload_count: number;
  download_count: number;
  updated_at: Date | string;
};

type MediaQuotaRow = {
  upload_limit_bytes: string | number | null;
  download_limit_bytes: string | number | null;
  hard_block_uploads: boolean;
  hard_block_downloads: boolean;
  updated_at: Date | string;
};

function toMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function toNumber(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  return Number(value);
}

function mapUsageRow(row: MediaUsageRow): MediaUsageMonth {
  return {
    monthKey: row.month_key,
    uploadBytes: Number(row.upload_bytes),
    downloadBytes: Number(row.download_bytes),
    uploadCount: Number(row.upload_count),
    downloadCount: Number(row.download_count),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapSettingsRow(row: MediaQuotaRow): MediaQuotaSettings {
  return {
    uploadLimitBytes: toNumber(row.upload_limit_bytes),
    downloadLimitBytes: toNumber(row.download_limit_bytes),
    hardBlockUploads: row.hard_block_uploads,
    hardBlockDownloads: row.hard_block_downloads,
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

async function ensureMonthRow(monthKey: string) {
  await db.query(
    `INSERT INTO media_usage_monthly (
      month_key,
      upload_bytes,
      download_bytes,
      upload_count,
      download_count,
      updated_at
    )
    VALUES ($1, 0, 0, 0, 0, NOW())
    ON CONFLICT (month_key) DO NOTHING`,
    [monthKey]
  );
}

export async function getMediaQuotaSettings() {
  await ensureDatabase();

  const result = await db.query<MediaQuotaRow>(
    `SELECT
      upload_limit_bytes,
      download_limit_bytes,
      hard_block_uploads,
      hard_block_downloads,
      updated_at
     FROM media_quota_settings
     WHERE id = 'global'
     LIMIT 1`
  );

  const row = result.rows[0];

  return mapSettingsRow(
    row ?? {
      upload_limit_bytes: null,
      download_limit_bytes: null,
      hard_block_uploads: false,
      hard_block_downloads: false,
      updated_at: new Date().toISOString()
    }
  );
}

export async function updateMediaQuotaSettings(input: {
  uploadLimitBytes: number | null;
  downloadLimitBytes: number | null;
  hardBlockUploads: boolean;
  hardBlockDownloads: boolean;
}) {
  await ensureDatabase();

  const updatedAt = new Date().toISOString();
  await db.query(
    `UPDATE media_quota_settings
     SET upload_limit_bytes = $1,
         download_limit_bytes = $2,
         hard_block_uploads = $3,
         hard_block_downloads = $4,
         updated_at = $5
     WHERE id = 'global'`,
    [input.uploadLimitBytes, input.downloadLimitBytes, input.hardBlockUploads, input.hardBlockDownloads, updatedAt]
  );

  return getMediaQuotaSettings();
}

export async function getMediaUsageMonth(monthKey = toMonthKey()) {
  await ensureDatabase();
  await ensureMonthRow(monthKey);

  const result = await db.query<MediaUsageRow>(
    `SELECT month_key, upload_bytes, download_bytes, upload_count, download_count, updated_at
     FROM media_usage_monthly
     WHERE month_key = $1
     LIMIT 1`,
    [monthKey]
  );

  return mapUsageRow(result.rows[0]);
}

export async function listRecentMediaUsageMonths(limit = 6) {
  await ensureDatabase();

  const result = await db.query<MediaUsageRow>(
    `SELECT month_key, upload_bytes, download_bytes, upload_count, download_count, updated_at
     FROM media_usage_monthly
     ORDER BY month_key DESC
     LIMIT $1`,
    [Math.max(1, Math.min(24, limit))]
  );

  return result.rows.map(mapUsageRow);
}

export async function assertMediaUploadAllowed(plannedBytes: number) {
  const [usage, settings] = await Promise.all([getMediaUsageMonth(), getMediaQuotaSettings()]);

  if (settings.hardBlockUploads) {
    throw new Error("MEDIA_UPLOADS_BLOCKED");
  }

  if (settings.uploadLimitBytes != null && usage.uploadBytes + plannedBytes > settings.uploadLimitBytes) {
    throw new Error("MEDIA_UPLOAD_LIMIT_REACHED");
  }
}

export async function assertMediaDownloadAllowed() {
  const [usage, settings] = await Promise.all([getMediaUsageMonth(), getMediaQuotaSettings()]);

  if (settings.hardBlockDownloads) {
    throw new Error("MEDIA_DOWNLOADS_BLOCKED");
  }

  if (settings.downloadLimitBytes != null && usage.downloadBytes >= settings.downloadLimitBytes) {
    throw new Error("MEDIA_DOWNLOAD_LIMIT_REACHED");
  }
}

export async function recordMediaUpload(bytes: number) {
  await ensureDatabase();
  const monthKey = toMonthKey();
  await ensureMonthRow(monthKey);

  await db.query(
    `UPDATE media_usage_monthly
     SET upload_bytes = upload_bytes + $2,
         upload_count = upload_count + 1,
         updated_at = NOW()
     WHERE month_key = $1`,
    [monthKey, Math.max(0, Math.floor(bytes))]
  );
}

export async function recordMediaDownload(bytes: number) {
  await ensureDatabase();
  const monthKey = toMonthKey();
  await ensureMonthRow(monthKey);

  await db.query(
    `UPDATE media_usage_monthly
     SET download_bytes = download_bytes + $2,
         download_count = download_count + 1,
         updated_at = NOW()
     WHERE month_key = $1`,
    [monthKey, Math.max(0, Math.floor(bytes))]
  );
}

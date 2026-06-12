import {
  getMediaQuotaSettings,
  getMediaUsageMonth,
  listRecentMediaUsageMonths,
  updateMediaQuotaSettings
} from "@/lib/media-usage";

export async function getMediaUsageDashboard() {
  const [currentMonth, recentMonths, settings] = await Promise.all([
    getMediaUsageMonth(),
    listRecentMediaUsageMonths(6),
    getMediaQuotaSettings()
  ]);

  return {
    currentMonth,
    recentMonths,
    settings
  };
}

export async function saveMediaUsageSettings(input: {
  uploadLimitBytes: number | null;
  downloadLimitBytes: number | null;
  hardBlockUploads: boolean;
  hardBlockDownloads: boolean;
}) {
  return updateMediaQuotaSettings(input);
}

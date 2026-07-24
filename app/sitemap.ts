import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://ielts-writing-checker.com";
  return ["zh-CN", "en"].flatMap((locale) => ["", "/privacy", "/terms", "/refund"].map((path) => ({
    url: `${baseUrl}/${locale}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" as const : "weekly" as const,
    priority: path ? 0.5 : 1
  })));
}

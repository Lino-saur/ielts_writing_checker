import { Locale } from "@/lib/types";

export const DEFAULT_LOCALE: Locale = "zh-CN";
export const LOCALE_STORAGE_KEY = "app-locale";
export const LOCALE_COOKIE_KEY = "app-locale";

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "zh-CN";
}

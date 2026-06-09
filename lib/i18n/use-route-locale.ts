"use client";

import { useMemo } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Locale } from "@/lib/types";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, LOCALE_STORAGE_KEY, isSupportedLocale } from "./config";

function replaceLocaleInPath(pathname: string, nextLocale: Locale) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `/${nextLocale}`;
  }

  if (isSupportedLocale(segments[0])) {
    segments[0] = nextLocale;
    return `/${segments.join("/")}`;
  }

  return `/${[nextLocale, ...segments].join("/")}`;
}

export function useRouteLocale() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const locale = useMemo<Locale>(() => {
    const value = params?.locale;
    return typeof value === "string" && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
  }, [params]);

  function setLocale(nextLocale: Locale) {
    if (nextLocale === locale) {
      return;
    }

    const nextPathname = replaceLocaleInPath(pathname, nextLocale);
    const query = searchParams.toString();
    const nextHref = query ? `${nextPathname}?${query}` : nextPathname;

    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`;
    router.replace(nextHref);
  }

  return [locale, setLocale] as const;
}

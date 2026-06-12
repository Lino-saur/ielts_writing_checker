import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, isSupportedLocale } from "@/lib/i18n/config";

function detectLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_KEY)?.value;
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  const header = request.headers.get("accept-language") || "";
  const tokens = header
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .filter(Boolean);

  for (const token of tokens) {
    if (isSupportedLocale(token)) {
      return token;
    }

    if (token.startsWith("zh")) {
      return "zh-CN";
    }

    if (token.startsWith("en")) {
      return "en";
    }
  }

  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/app-icons") ||
    pathname.startsWith("/around-icons") ||
    pathname.startsWith("/around-product") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isSupportedLocale(segments[0])) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/checker" || pathname === "/history") {
    const locale = detectLocale(request);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname =
      pathname === "/" ? `/${locale}` : pathname === "/checker" ? `/${locale}/checker` : `/${locale}/history`;
    nextUrl.search = search;
    return NextResponse.redirect(nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

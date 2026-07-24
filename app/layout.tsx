import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthSessionProvider } from "@/lib/auth-client-session";
import { getServerSessionContext } from "@/lib/server-session-context";
import "./around-icons.css";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ielts-writing-checker.com"),
  title: "IELTS Writing Checker",
  description: "AI powered IELTS writing checker for Task 1 and Task 2.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "IELTS Writing Checker",
    description: "AI-assisted IELTS writing review for Task 1 and Task 2.",
    type: "website"
  },
  icons: {
    icon: [
      { url: "/app-icons/icon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/app-icons/icon.png", type: "image/png", sizes: "512x512" }
    ],
    apple: [{ url: "/app-icons/icon-180x180.png", type: "image/png", sizes: "180x180" }],
    shortcut: [{ url: "/app-icons/favicon.ico", type: "image/x-icon" }]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-app-locale") === "zh-CN" ? "zh-CN" : "en";
  const initialSessionContext = await getServerSessionContext();

  return (
    <html lang={locale}>
      <body>
        <AuthSessionProvider initialSessionContext={initialSessionContext}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}

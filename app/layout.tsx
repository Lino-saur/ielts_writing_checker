import type { Metadata } from "next";
import { AuthSessionProvider } from "@/lib/auth-client-session";
import { getServerSessionContext } from "@/lib/server-session-context";
import "./around-icons.css";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IELTS Writing Checker",
  description: "AI powered IELTS writing checker for Task 1 and Task 2.",
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
  const initialSessionContext = await getServerSessionContext();

  return (
    <html lang="en">
      <body>
        <AuthSessionProvider initialSessionContext={initialSessionContext}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}

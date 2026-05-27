import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS Writing Checker",
  description: "AI powered IELTS writing checker for Task 1 and Task 2.",
  icons: {
    icon: "/app-icons/icon-32x32.png",
    apple: "/app-icons/icon-180x180.png",
    shortcut: "/app-icons/favicon.ico"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/around-icons/around-icons.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}

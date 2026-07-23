import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: {
    default: "运营后台 | IELTS Writing Checker",
    template: "%s | 运营后台 | IELTS Writing Checker"
  },
  description: "IELTS Writing Checker 内部运营管理后台。"
};

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}

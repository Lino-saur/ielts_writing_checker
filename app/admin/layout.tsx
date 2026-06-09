import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: {
    default: "Admin | IELTS Writing Checker",
    template: "%s | Admin | IELTS Writing Checker"
  },
  description: "Internal admin workspace for IELTS Writing Checker."
};

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}

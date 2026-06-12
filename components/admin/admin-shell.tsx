"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFeedbackPage = pathname.startsWith("/admin/feedback");
  const isSupportPage = pathname.startsWith("/admin/support");
  const isEnergyPage = pathname.startsWith("/admin/energy");
  const isMediaUsagePage = pathname.startsWith("/admin/media-usage");

  if (pathname === "/admin/login" || pathname === "/admin/unauthorized") {
    return <div className={styles.shell}>{children}</div>;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.eyebrow}>Hyper-style Admin</span>
            <strong className={styles.title}>IELTS Ops</strong>
            <p className={styles.caption}>A dedicated internal surface for feedback triage and future admin workflows.</p>
          </div>

          <nav className={styles.nav}>
            <span className={styles.navSection}>Workspace</span>
            <Link
              href="/admin/feedback"
              className={`${styles.navLink} ${isFeedbackPage ? styles.navLinkActive : ""}`}
            >
              Feedback Inbox
            </Link>
            <Link
              href="/admin/support"
              className={`${styles.navLink} ${isSupportPage ? styles.navLinkActive : ""}`}
            >
              Support Inbox
            </Link>
            <Link
              href="/admin/energy"
              className={`${styles.navLink} ${isEnergyPage ? styles.navLinkActive : ""}`}
            >
              Energy Grant
            </Link>
            <Link
              href="/admin/media-usage"
              className={`${styles.navLink} ${isMediaUsagePage ? styles.navLinkActive : ""}`}
            >
              Media Quota
            </Link>
            <span className={styles.navSection}>App</span>
            <Link href="/" className={styles.navLink}>
              Public Site
            </Link>
            <Link href="/checker" className={styles.navLink}>
              Checker
            </Link>
          </nav>

          <div className={styles.sidebarFooter}>
            <p className={styles.caption}>Admin UI is intentionally isolated from the public product UI to keep future app split cheap.</p>
          </div>
        </aside>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

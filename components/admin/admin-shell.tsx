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
  const isHistoricalPracticePage = pathname.startsWith("/admin/historical-practice");
  const isTeachingRulesPage = pathname.startsWith("/admin/teaching-rules");
  const isAssignmentsPage = pathname.startsWith("/admin/assignments");

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
            <p className={styles.caption}>Internal tools for content, user support and operational controls.</p>
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
            <Link
              href="/admin/historical-practice"
              className={`${styles.navLink} ${isHistoricalPracticePage ? styles.navLinkActive : ""}`}
            >
              Historical Questions
            </Link>
            <Link
              href="/admin/teaching-rules"
              className={`${styles.navLink} ${isTeachingRulesPage ? styles.navLinkActive : ""}`}
            >
              Teaching Rules
            </Link>
            <Link
              href="/admin/assignments"
              className={`${styles.navLink} ${isAssignmentsPage ? styles.navLinkActive : ""}`}
            >
              Assignments
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
            <p className={styles.caption}>
              Teaching rules require an explicit publish step before they can be used by review workflows.
            </p>
          </div>
        </aside>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

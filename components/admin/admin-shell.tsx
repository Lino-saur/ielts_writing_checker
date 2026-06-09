"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
            <Link href="/admin/feedback" className={`${styles.navLink} ${styles.navLinkActive}`}>
              Feedback Inbox
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

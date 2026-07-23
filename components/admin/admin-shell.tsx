"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-shell.module.css";

const navigation = [
  {
    label: "概览",
    items: [{ href: "/admin", label: "运营看板", mark: "览" }]
  },
  {
    label: "用户与交易",
    items: [
      { href: "/admin/feedback", label: "用户反馈", mark: "馈" },
      { href: "/admin/support", label: "客服工单", mark: "服" },
      { href: "/admin/order-support", label: "订单与退款", mark: "单" }
    ]
  },
  {
    label: "教学内容",
    items: [
      { href: "/admin/assignments", label: "作业管理", mark: "业" },
      { href: "/admin/historical-practice", label: "历史题库", mark: "题" },
      { href: "/admin/teaching-rules", label: "教学规则", mark: "规" }
    ]
  },
  {
    label: "系统工具",
    items: [
      { href: "/admin/energy", label: "墨水发放", mark: "墨" },
      { href: "/admin/media-usage", label: "媒体额度", mark: "媒" }
    ]
  }
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

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
            <span className={styles.brandMark}>IO</span>
            <div>
              <strong className={styles.title}>IELTS Ops</strong>
              <p className={styles.caption}>运营管理后台</p>
            </div>
          </div>

          <nav className={styles.nav} aria-label="后台导航">
            {navigation.map((group) => (
              <section className={styles.navGroup} key={group.label}>
                <span className={styles.navSection}>{group.label}</span>
                <div className={styles.navItems}>
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        href={item.href}
                        className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                        aria-current={active ? "page" : undefined}
                        key={item.href}
                      >
                        <span className={styles.navMark} aria-hidden="true">{item.mark}</span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <span className={styles.navSection}>前台入口</span>
            <div className={styles.appLinks}>
              <Link href="/">网站首页 ↗</Link>
              <Link href="/checker">作文批改 ↗</Link>
            </div>
          </div>
        </aside>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

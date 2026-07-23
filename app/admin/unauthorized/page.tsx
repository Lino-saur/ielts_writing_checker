import Link from "next/link";
import styles from "@/components/admin/admin-state.module.css";

export const metadata = {
  title: "无权访问"
};

export default function AdminUnauthorizedPage() {
  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>需要后台权限</p>
        <h1 className={styles.title}>当前账号没有后台访问权限</h1>
        <p className={styles.body}>
          请联系管理员将当前账号加入 <code>admin_users</code> 权限表后再试。
        </p>
        <div className={styles.actions}>
          <Link href="/admin/login" className={styles.link}>
            切换账号
          </Link>
          <Link href="/" className={styles.link}>
            返回网站首页
          </Link>
        </div>
      </section>
    </div>
  );
}

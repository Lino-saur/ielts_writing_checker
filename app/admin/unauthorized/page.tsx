import Link from "next/link";
import styles from "@/components/admin/admin-state.module.css";

export const metadata = {
  title: "Unauthorized"
};

export default function AdminUnauthorizedPage() {
  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Admin access required</p>
        <h1 className={styles.title}>You do not have permission to open this workspace.</h1>
        <p className={styles.body}>
          This admin surface is restricted. Ask for your account to be added to the <code>admin_users</code> table
          before trying again.
        </p>
        <div className={styles.actions}>
          <Link href="/admin/login" className={styles.link}>
            Switch account
          </Link>
          <Link href="/" className={styles.link}>
            Back to public site
          </Link>
        </div>
      </section>
    </div>
  );
}

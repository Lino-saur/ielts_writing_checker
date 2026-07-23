"use client";

import styles from "@/components/admin/admin-state.module.css";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>后台页面异常</p>
        <h1 className={styles.title}>后台暂时无法加载</h1>
        <p className={styles.body}>
          {error.message || "页面加载过程中出现了意外错误。"}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={reset}>
            重试
          </button>
        </div>
      </section>
    </div>
  );
}

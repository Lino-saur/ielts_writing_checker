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
        <p className={styles.eyebrow}>Admin route error</p>
        <h1 className={styles.title}>The admin workspace failed to load.</h1>
        <p className={styles.body}>
          {error.message || "An unexpected error interrupted this admin route."}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </div>
  );
}

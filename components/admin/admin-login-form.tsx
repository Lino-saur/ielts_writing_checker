"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./admin-login.module.css";

type AdminLoginFormProps = {
  mode: "login" | "forbidden";
  userEmail?: string | null;
};

export function AdminLoginForm({ mode, userEmail }: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(userEmail || "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password
      });

      if (result.error) {
        throw new Error(result.error.message || "LOGIN_FAILED");
      }

      router.push("/admin/feedback");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "LOGIN_FAILED");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message || "SIGN_OUT_FAILED");
      }

      setEmail("");
      setPassword("");
      router.refresh();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "SIGN_OUT_FAILED");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.hero}>
          <p className={styles.heroEyebrow}>Hyper-inspired admin access</p>
          <h1 className={styles.heroTitle}>Admin login is a separate front door from the public product.</h1>
          <p className={styles.heroBody}>
            This workspace is isolated for operations, feedback triage and future internal tooling. It uses a dedicated
            entry surface so the later split into a standalone admin app stays cheap.
          </p>

          <div className={styles.heroGrid}>
            <article className={styles.heroCard}>
              <span>Scope</span>
              <strong>Internal only</strong>
              <p>Feedback, moderation, operations and model-quality workflows stay out of the public product shell.</p>
            </article>
            <article className={styles.heroCard}>
              <span>Direction</span>
              <strong>Split-ready</strong>
              <p>Admin routing, UI and API boundaries are already being isolated for a later `apps/admin` split.</p>
            </article>
          </div>
        </section>

        <section className={styles.auth}>
          <div className={styles.authHeader}>
            <span>{mode === "forbidden" ? "Admin access blocked" : "Admin sign in"}</span>
            <h1>{mode === "forbidden" ? "This account is signed in, but not allowed here." : "Sign in to the admin workspace."}</h1>
            <p>
              {mode === "forbidden"
                ? "Use an account that exists in admin_users, or sign out and switch accounts."
                : "Use a permitted account. The admin workspace checks the same auth system, but against a dedicated admin_users table."}
            </p>
          </div>

          {mode === "login" ? (
            <form className={styles.form} onSubmit={handleLogin}>
              <label className={styles.field}>
                <span>Email</span>
                <div className={styles.inputWrap}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>Password</span>
                <div className={styles.inputWrap}>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </label>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? "Signing in..." : "Continue to admin"}
              </button>
            </form>
          ) : (
            <>
              <div className={styles.info}>
                <strong>Current account</strong>
                <p>{userEmail || "Signed in without a recognized admin identity."}</p>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.actions}>
                <button type="button" className={styles.ghostButtonPlain} onClick={() => void handleSignOut()} disabled={submitting}>
                  {submitting ? "Signing out..." : "Sign out and switch account"}
                </button>
                <Link href="/" className={styles.linkButton}>
                  Back to public site
                </Link>
              </div>
            </>
          )}

          {mode === "login" ? (
            <>
              <div className={styles.info}>
                <strong>Admin allow list</strong>
                <p>Access is granted through the `admin_users` table. Public users should never land directly inside the admin dashboard.</p>
              </div>

              <div className={styles.actions}>
                <Link href="/" className={styles.linkButton}>
                  Back to public site
                </Link>
                <Link href="/checker" className={styles.ghostButton}>
                  Open checker
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

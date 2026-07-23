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
          <p className={styles.heroEyebrow}>内部运营入口</p>
          <h1 className={styles.heroTitle}>独立、安全的运营管理后台</h1>
          <p className={styles.heroBody}>
            集中处理用户反馈、客服工单、内容维护和日常运营操作，与用户端产品保持隔离。
          </p>

          <div className={styles.heroGrid}>
            <article className={styles.heroCard}>
              <span>使用范围</span>
              <strong>仅限内部人员</strong>
              <p>用户反馈、内容审核、运营和质量管理均在后台独立完成。</p>
            </article>
            <article className={styles.heroCard}>
              <span>权限控制</span>
              <strong>账号白名单</strong>
              <p>只有加入后台权限表的账号才能进入运营工作区。</p>
            </article>
          </div>
        </section>

        <section className={styles.auth}>
          <div className={styles.authHeader}>
            <span>{mode === "forbidden" ? "后台访问受限" : "后台登录"}</span>
            <h1>{mode === "forbidden" ? "当前账号没有后台权限" : "登录运营管理后台"}</h1>
            <p>
              {mode === "forbidden"
                ? "请使用已加入 admin_users 权限表的账号，或者退出后切换账号。"
                : "请使用已获得后台权限的账号登录。"}
            </p>
          </div>

          {mode === "login" ? (
            <form className={styles.form} onSubmit={handleLogin}>
              <label className={styles.field}>
                <span>邮箱</span>
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
                <span>密码</span>
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
                {submitting ? "登录中…" : "进入后台"}
              </button>
            </form>
          ) : (
            <>
              <div className={styles.info}>
                <strong>当前账号</strong>
                <p>{userEmail || "当前登录账号无法识别。"}</p>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.actions}>
                <button type="button" className={styles.ghostButtonPlain} onClick={() => void handleSignOut()} disabled={submitting}>
                  {submitting ? "退出中…" : "退出并切换账号"}
                </button>
                <Link href="/" className={styles.linkButton}>
                  返回网站首页
                </Link>
              </div>
            </>
          )}

          {mode === "login" ? (
            <>
              <div className={styles.info}>
                <strong>后台账号白名单</strong>
                <p>访问权限由 <code>admin_users</code> 表控制，普通用户无法进入后台。</p>
              </div>

              <div className={styles.actions}>
                <Link href="/" className={styles.linkButton}>
                  返回网站首页
                </Link>
                <Link href="/checker" className={styles.ghostButton}>
                  打开作文批改
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

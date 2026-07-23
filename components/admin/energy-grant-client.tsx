"use client";

import { FormEvent, useEffect, useState } from "react";
import { ActionButton, Surface } from "@/components/ui-kit";
import styles from "./energy-grant.module.css";

type UserSearchResult = {
  id: string;
  email: string | null;
  name: string | null;
};

type RecentGrant = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  amount: number;
  balanceAfter: number;
  source: string;
  createdAt: string;
};

type GrantResponse = {
  userId: string;
  energy: {
    balance: number;
    totalConsumed: number;
    totalRecharged: number;
    updatedAt: string;
  };
};

function getErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === "string" ? error : "REQUEST_FAILED";
  }

  return "REQUEST_FAILED";
}

export function EnergyGrantClient() {
  const [searchEmail, setSearchEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("20");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [result, setResult] = useState<GrantResponse | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [recentGrants, setRecentGrants] = useState<RecentGrant[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentGrants() {
      setLoadingRecent(true);
      setRecentError(null);

      try {
        const response = await fetch("/api/admin/energy/grants?limit=12", {
          cache: "no-store"
        });
        const payload = (await response.json()) as { items?: RecentGrant[]; error?: string };

        if (!response.ok) {
          throw new Error(getErrorMessage(payload));
        }

        if (!cancelled) {
          setRecentGrants(payload.items ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRecentError(loadError instanceof Error ? loadError.message : "REQUEST_FAILED");
        }
      } finally {
        if (!cancelled) {
          setLoadingRecent(false);
        }
      }
    }

    void loadRecentGrants();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching) {
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({
        q: searchEmail.trim()
      });
      const response = await fetch(`/api/admin/users/search?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { items?: UserSearchResult[]; error?: string };

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      setSearchResults(payload.items ?? []);
    } catch (searchLoadError) {
      setSearchError(searchLoadError instanceof Error ? searchLoadError.message : "REQUEST_FAILED");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/energy/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userId.trim(),
          amount: Number(amount),
          reason: reason.trim()
        })
      });

      const payload = (await response.json()) as GrantResponse | { error?: string };

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      if (!("energy" in payload)) {
        throw new Error("INVALID_RESPONSE");
      }

      setResult(payload);
      setRecentGrants((current) => [
        {
          id: `${payload.userId}-${payload.energy.updatedAt}`,
          userId: payload.userId,
          userEmail: searchResults.find((item) => item.id === payload.userId)?.email ?? null,
          userName: searchResults.find((item) => item.id === payload.userId)?.name ?? null,
          amount: Number(amount),
          balanceAfter: payload.energy.balance,
          source: `admin:manual:${reason.trim() || "manual_grant"}`,
          createdAt: payload.energy.updatedAt
        },
        ...current
      ].slice(0, 12));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "REQUEST_FAILED");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Surface className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>内部运营工具</p>
          <h1 className={styles.title}>手动发放墨水</h1>
          <p className={styles.body}>
            用于客服补偿、数据迁移、退款处理或内部测试。发放前请确认用户信息和数量。
          </p>
        </div>
      </Surface>

      <Surface as="form" className={styles.panel} onSubmit={handleSearch}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>按邮箱查找用户</h2>
            <p className={styles.sectionBody}>搜索用户后，点击结果即可自动填写用户 ID。</p>
          </div>
        </div>

        <div className={styles.searchRow}>
          <label className={styles.field}>
            <span>邮箱</span>
            <input
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="student@example.com"
              autoComplete="off"
            />
          </label>

          <div className={styles.searchAction}>
            <ActionButton type="submit" variant="secondary" disabled={searching}>
              {searching ? "搜索中…" : "搜索用户"}
            </ActionButton>
          </div>
        </div>

        {searchError ? <div className={styles.error}>{searchError}</div> : null}

        <div className={styles.resultList}>
          {searchResults.length ? (
            searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.resultCard}
                onClick={() => setUserId(item.id)}
              >
                <strong>{item.email || item.id}</strong>
                <span>{item.name || "未设置昵称"}</span>
                <span>{item.id}</span>
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>请输入邮箱搜索用户。</div>
          )}
        </div>
      </Surface>

      <Surface as="form" className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>发放墨水</h2>
            <p className={styles.sectionBody}>请填写用户 ID、发放数量和操作原因。</p>
          </div>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>用户 ID</span>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="用户 ID"
              autoComplete="off"
              required
            />
          </label>

          <label className={styles.field}>
            <span>发放数量</span>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>操作原因</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="例如：客服补偿、退款处理"
            maxLength={120}
          />
        </label>

        {error ? <div className={styles.error}>{error}</div> : null}

        {result ? (
          <div className={styles.success}>
            <strong>墨水发放成功</strong>
            <span>用户：{result.userId}</span>
            <span>当前墨水：{result.energy.balance}</span>
            <span>累计充值：{result.energy.totalRecharged}</span>
            <span>更新时间：{new Date(result.energy.updatedAt).toLocaleString("zh-CN")}</span>
          </div>
        ) : null}

        <div className={styles.actions}>
          <ActionButton type="submit" variant="primary" disabled={submitting}>
            {submitting ? "发放中…" : "确认发放"}
          </ActionButton>
        </div>
      </Surface>

      <Surface className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>最近发放记录</h2>
            <p className={styles.sectionBody}>最近由后台人工完成的墨水操作。</p>
          </div>
        </div>

        {recentError ? <div className={styles.error}>{recentError}</div> : null}

        <div className={styles.resultList}>
          {loadingRecent ? (
            <div className={styles.emptyState}>正在加载发放记录…</div>
          ) : recentGrants.length ? (
            recentGrants.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.resultCard}
                onClick={() => setUserId(item.userId)}
              >
                <strong>{item.userEmail || item.userId}</strong>
                <span>{item.userName || "未知用户"}</span>
                <span>
                  +{item.amount} 瓶墨水，余额 {item.balanceAfter}
                </span>
                <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>暂无人工发放记录。</div>
          )}
        </div>
      </Surface>
    </div>
  );
}

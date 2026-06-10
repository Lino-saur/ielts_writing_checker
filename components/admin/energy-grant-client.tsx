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
          <p className={styles.eyebrow}>Internal Ops</p>
          <h1 className={styles.title}>Grant energy manually</h1>
          <p className={styles.body}>
            Use this only for support, migration, refunds, or internal testing. Input expects the Better Auth user id.
          </p>
        </div>
      </Surface>

      <Surface as="form" className={styles.panel} onSubmit={handleSearch}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Find user by email</h2>
            <p className={styles.sectionBody}>Search Better Auth users, then tap a row to fill the user id.</p>
          </div>
        </div>

        <div className={styles.searchRow}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="student@example.com"
              autoComplete="off"
            />
          </label>

          <div className={styles.searchAction}>
            <ActionButton type="submit" variant="secondary" disabled={searching}>
              {searching ? "Searching..." : "Search User"}
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
                <span>{item.name || "Unnamed user"}</span>
                <span>{item.id}</span>
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>No user results yet.</div>
          )}
        </div>
      </Surface>

      <Surface as="form" className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Grant energy</h2>
            <p className={styles.sectionBody}>Manual support tool for credits, migration, refunds, and QA.</p>
          </div>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>User ID</span>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="auth user id"
              autoComplete="off"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Amount</span>
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
          <span>Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="support_case_123"
            maxLength={120}
          />
        </label>

        {error ? <div className={styles.error}>{error}</div> : null}

        {result ? (
          <div className={styles.success}>
            <strong>Grant applied.</strong>
            <span>User: {result.userId}</span>
            <span>Balance: {result.energy.balance}</span>
            <span>Total recharged: {result.energy.totalRecharged}</span>
            <span>Updated: {new Date(result.energy.updatedAt).toLocaleString()}</span>
          </div>
        ) : null}

        <div className={styles.actions}>
          <ActionButton type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Granting..." : "Grant Energy"}
          </ActionButton>
        </div>
      </Surface>

      <Surface className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Recent admin grants</h2>
            <p className={styles.sectionBody}>Latest manual energy operations from admin users.</p>
          </div>
        </div>

        {recentError ? <div className={styles.error}>{recentError}</div> : null}

        <div className={styles.resultList}>
          {loadingRecent ? (
            <div className={styles.emptyState}>Loading recent grants...</div>
          ) : recentGrants.length ? (
            recentGrants.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.resultCard}
                onClick={() => setUserId(item.userId)}
              >
                <strong>{item.userEmail || item.userId}</strong>
                <span>{item.userName || "Unknown user"}</span>
                <span>
                  +{item.amount} energy, balance {item.balanceAfter}
                </span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </button>
            ))
          ) : (
            <div className={styles.emptyState}>No admin grants yet.</div>
          )}
        </div>
      </Surface>
    </div>
  );
}

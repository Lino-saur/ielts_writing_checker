"use client";

import { createContext, useContext, useMemo, useState } from "react";

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};

type SessionPayload = {
  user?: SessionUser;
};

type EnergyPayload = {
  energy?: {
    balance: number;
    totalConsumed: number;
    totalRecharged: number;
    updatedAt: string;
    unlimitedUntil?: string | null;
  };
  cost?: number;
};

export type ClientSessionContext = {
  user: SessionUser | null;
  energy: NonNullable<EnergyPayload["energy"]> | null;
  reviewCost: number | null;
};

type AuthSessionValue = {
  sessionContext: ClientSessionContext;
  sessionResolved: boolean;
  refreshSessionContext: () => Promise<ClientSessionContext>;
  setSessionContext: (value: ClientSessionContext) => void;
};

async function getAuthClient() {
  const { authClient } = await import("@/lib/auth-client");
  return authClient;
}

function getErrorMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "error" in value) {
    const error = (value as { error?: unknown }).error;
    return typeof error === "string" ? error : undefined;
  }

  return undefined;
}

async function fetchJson<T>(input: RequestInfo | URL) {
  const response = await fetch(input, {
    cache: "no-store"
  });
  const data = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(getErrorMessage(data) || "REQUEST_FAILED");
  }

  return data;
}

async function loadClientSessionContext() {
  const authClient = await getAuthClient();
  const sessionResult = await authClient.getSession();

  if (!sessionResult.data) {
    return {
      user: null,
      energy: null,
      reviewCost: null
    } satisfies ClientSessionContext;
  }

  try {
    const [sessionData, energyData] = await Promise.all([
      fetchJson<SessionPayload>("/api/session"),
      fetchJson<EnergyPayload>("/api/energy")
    ]);

    return {
      user: sessionData.user ?? null,
      energy: energyData.energy ?? null,
      reviewCost: energyData.cost ?? null
    } satisfies ClientSessionContext;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return {
        user: null,
        energy: null,
        reviewCost: null
      } satisfies ClientSessionContext;
    }

    throw error;
  }
}

let clientSessionContextPromise: Promise<ClientSessionContext> | null = null;

export function getClientSessionContext(options?: { forceRefresh?: boolean }) {
  if (options?.forceRefresh) {
    clientSessionContextPromise = null;
  }

  if (!clientSessionContextPromise) {
    clientSessionContextPromise = loadClientSessionContext().catch((error) => {
      clientSessionContextPromise = null;
      throw error;
    });
  }

  return clientSessionContextPromise;
}

export function invalidateClientSessionContext() {
  clientSessionContextPromise = null;
}

const DEFAULT_SESSION_CONTEXT: ClientSessionContext = {
  user: null,
  energy: null,
  reviewCost: null
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({
  children,
  initialSessionContext
}: {
  children: React.ReactNode;
  initialSessionContext: ClientSessionContext;
}) {
  const [sessionContext, setSessionContextState] = useState<ClientSessionContext>(initialSessionContext);
  const [sessionResolved, setSessionResolved] = useState(true);

  async function refreshSessionContext() {
    const nextContext = await getClientSessionContext({ forceRefresh: true });
    setSessionContextState(nextContext);
    setSessionResolved(true);
    return nextContext;
  }

  function setSessionContext(value: ClientSessionContext) {
    setSessionContextState(value);
    setSessionResolved(true);
    clientSessionContextPromise = Promise.resolve(value);
  }

  const value = useMemo<AuthSessionValue>(
    () => ({
      sessionContext,
      sessionResolved,
      refreshSessionContext,
      setSessionContext
    }),
    [sessionContext, sessionResolved]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (context) {
    return context;
  }

  return {
    sessionContext: DEFAULT_SESSION_CONTEXT,
    sessionResolved: false,
    refreshSessionContext: () => getClientSessionContext({ forceRefresh: true }),
    setSessionContext: () => {}
  } satisfies AuthSessionValue;
}

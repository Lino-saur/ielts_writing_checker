"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNavbar } from "@/components/app-navbar";
import { LoadingLottie } from "@/components/loading-lottie";
import { ActionButton, ActionLink, Pill, Surface } from "@/components/ui-kit";
import { useAuthSession } from "@/lib/auth-client-session";
import { getMessages } from "@/lib/i18n/messages";
import { useRouteLocale } from "@/lib/i18n/use-route-locale";
import type { OrderSupportKind, OrderSupportRequest, RechargeOrder, RechargeOrderStatus } from "@/lib/types";

function orderStatusLabel(status: RechargeOrderStatus, copy: ReturnType<typeof getMessages>["navbar"]) {
  if (status === "paid") return copy.ordersStatusPaid;
  if (status === "pending") return copy.ordersStatusPending;
  if (status === "failed") return copy.ordersStatusFailed;
  if (status === "refunded") return copy.ordersStatusRefunded;
  return copy.ordersStatusCancelled;
}

function statusTone(status: RechargeOrderStatus) {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  return "error";
}

export default function OrdersPageClient() {
  const { sessionContext, sessionResolved } = useAuthSession();
  const [locale, setLocale] = useRouteLocale();
  const [items, setItems] = useState<RechargeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequest, setAuthRequest] = useState<{ mode: "signIn" | "signUp"; id: number } | null>(null);
  const [supportRequests, setSupportRequests] = useState<OrderSupportRequest[]>([]);
  const [supportOrder, setSupportOrder] = useState<RechargeOrder | null>(null);
  const [supportKind, setSupportKind] = useState<OrderSupportKind>("inquiry");
  const [supportReason, setSupportReason] = useState("");
  const [supportDetails, setSupportDetails] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const { navbar } = getMessages(locale);
  const checkerHref = useMemo(() => `/${locale}/checker`, [locale]);
  const isAuthenticated = Boolean(sessionContext.user);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersResponse, supportResponse] = await Promise.all([
        fetch("/api/recharge/orders", { cache: "no-store" }),
        fetch("/api/order-support", { cache: "no-store" })
      ]);
      const data = (await ordersResponse.json()) as { items?: RechargeOrder[]; error?: string };
      const supportData = (await supportResponse.json()) as { items?: OrderSupportRequest[]; error?: string };
      if (!ordersResponse.ok || !data.items || !supportResponse.ok || !supportData.items) {
        throw new Error(data.error || supportData.error || "REQUEST_FAILED");
      }
      setItems(data.items);
      setSupportRequests(supportData.items);
    } catch {
      setError(navbar.ordersLoadError);
    } finally {
      setLoading(false);
    }
  }, [navbar.ordersLoadError]);

  function openSupport(order: RechargeOrder, kind: OrderSupportKind) {
    setSupportOrder(order);
    setSupportKind(kind);
    setSupportReason(kind === "refund" ? navbar.ordersRefundDefaultReason : "");
    setSupportDetails("");
    setSupportError(null);
  }

  async function submitSupport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supportOrder || !supportReason.trim() || supportSubmitting) return;
    setSupportSubmitting(true);
    setSupportError(null);
    try {
      const response = await fetch("/api/order-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: supportOrder.id,
          kind: supportKind,
          reason: supportReason.trim(),
          details: supportDetails.trim()
        })
      });
      const data = (await response.json()) as { item?: OrderSupportRequest; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "REQUEST_FAILED");
      setSupportRequests((current) => [data.item!, ...current]);
      setSupportOrder(null);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "REQUEST_FAILED";
      setSupportError(message === "ORDER_NOT_REFUNDABLE" ? navbar.ordersRefundUnavailable : navbar.ordersSupportSubmitError);
    } finally {
      setSupportSubmitting(false);
    }
  }

  useEffect(() => {
    if (!sessionResolved) return;
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    void loadOrders();
  }, [isAuthenticated, loadOrders, sessionResolved]);

  return (
    <main className="pageShell">
      <div className="pageBackdrop" aria-hidden="true">
        <span className="backdropOrb orbOne" />
        <span className="backdropOrb orbTwo" />
        <span className="backdropGrid" />
      </div>

      <AppNavbar
        locale={locale}
        onLocaleChange={setLocale}
        copy={navbar}
        energyBalance={sessionContext.energy?.balance ?? null}
        authRequest={authRequest}
      />

      {!sessionResolved ? (
        <Surface className="ordersStateCard">
          <LoadingLottie label={navbar.ordersLoading} showLabel={false} />
        </Surface>
      ) : !isAuthenticated ? (
        <Surface className="ordersStateCard">
          <h1>{navbar.ordersAuthTitle}</h1>
          <p>{navbar.ordersAuthBody}</p>
          <div className="historyAuthActions">
            <ActionButton onClick={() => setAuthRequest({ mode: "signIn", id: Date.now() })}>{navbar.login}</ActionButton>
            <ActionButton variant="primary" onClick={() => setAuthRequest({ mode: "signUp", id: Date.now() })}>
              {navbar.createOne}
            </ActionButton>
          </div>
        </Surface>
      ) : (
        <section className="ordersPageSection">
          <Surface className="ordersSurface">
            <div className="ordersPageHeader">
              <div>
                <h1>{navbar.ordersTitle}</h1>
                <p>{navbar.ordersSubtitle.replace("{count}", String(items.length))}</p>
              </div>
              <div className="ordersHeaderActions">
                <ActionButton variant="secondary" onClick={() => void loadOrders()} disabled={loading}>
                  {navbar.ordersRefresh}
                </ActionButton>
                <ActionLink href={checkerHref} variant="secondary">{navbar.ordersBack}</ActionLink>
              </div>
            </div>

            {loading ? (
              <div className="ordersInlineState"><LoadingLottie label={navbar.ordersLoading} /></div>
            ) : error ? (
              <div className="ordersInlineState">
                <p className="errorBox">{error}</p>
                <ActionButton onClick={() => void loadOrders()}>{navbar.ordersRetry}</ActionButton>
              </div>
            ) : items.length === 0 ? (
              <div className="ordersInlineState">
                <h2>{navbar.ordersEmptyTitle}</h2>
                <p>{navbar.ordersEmptyBody}</p>
                <ActionLink href={checkerHref} variant="primary">{navbar.ordersEmptyAction}</ActionLink>
              </div>
            ) : (
              <div className="ordersList">
                {items.map((order) => {
                  const latestSupport = supportRequests.find((request) => request.orderId === order.id);
                  const amount = new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en", {
                    style: "currency",
                    currency: order.currency,
                    maximumFractionDigits: 2
                  }).format(order.amountCents / 100);
                  const purchasedAt = new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(order.createdAt));
                  return (
                    <article className="orderCard" key={order.id}>
                      <div className="orderCardMain">
                        <div className="orderCardTitleRow">
                          <h2>
                            {order.unlimitedDays
                              ? navbar.ordersUnlimitedPlan.replace("{days}", String(order.unlimitedDays))
                              : navbar.ordersInkPlan.replace("{amount}", String(order.totalEnergyAmount))}
                          </h2>
                          <Pill data-tone={statusTone(order.status)}>{orderStatusLabel(order.status, navbar)}</Pill>
                        </div>
                        <dl className="orderMetaGrid">
                          <div><dt>{navbar.ordersNumber}</dt><dd>{order.id}</dd></div>
                          <div><dt>{navbar.ordersPurchasedAt}</dt><dd>{purchasedAt}</dd></div>
                          <div><dt>{navbar.ordersPaymentMethod}</dt><dd>{navbar.ordersWechat}</dd></div>
                          <div><dt>{navbar.ordersPaidAmount}</dt><dd className="orderAmount">{amount}</dd></div>
                        </dl>
                        {latestSupport ? (
                          <div className="orderSupportProgress">
                            <span>{latestSupport.kind === "refund" ? navbar.ordersRefundRequest : navbar.ordersQuestion}</span>
                            <strong>{navbar[`ordersSupportStatus_${latestSupport.status}`]}</strong>
                            {latestSupport.adminNote ? <p>{latestSupport.adminNote}</p> : null}
                          </div>
                        ) : null}
                        <div className="orderCardActions">
                          <ActionButton variant="secondary" onClick={() => openSupport(order, "inquiry")}>{navbar.ordersQuestion}</ActionButton>
                          {order.status === "paid" ? (
                            <ActionButton
                              variant="plain"
                              onClick={() => openSupport(order, "refund")}
                              disabled={supportRequests.some((request) => request.orderId === order.id && request.kind === "refund" && ["open", "reviewing", "approved"].includes(request.status))}
                            >
                              {navbar.ordersRefundRequest}
                            </ActionButton>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Surface>
        </section>
      )}

      {supportOrder ? (
        <div className="authDialogBackdrop" onClick={() => !supportSubmitting && setSupportOrder(null)}>
          <Surface className="authDialog" onClick={(event) => event.stopPropagation()}>
            <div className="authDialogHeader">
              <div className="authCardIntro">
                <h2>{supportKind === "refund" ? navbar.ordersRefundTitle : navbar.ordersQuestionTitle}</h2>
                <p className="authHint">{supportKind === "refund" ? navbar.ordersRefundHint : navbar.ordersQuestionHint}</p>
              </div>
              <button type="button" className="authDialogClose" onClick={() => setSupportOrder(null)} disabled={supportSubmitting} aria-label={navbar.authClose}>
                <i className="ai-cross" aria-hidden="true" />
              </button>
            </div>
            <form className="authForm" onSubmit={submitSupport}>
              <div className="orderSupportOrderRef">{navbar.ordersNumber}: {supportOrder.id}</div>
              <label className="authField">
                <span>{navbar.ordersSupportReason}</span>
                <input value={supportReason} onChange={(event) => setSupportReason(event.target.value)} maxLength={120} required disabled={supportSubmitting} />
              </label>
              <label className="authField">
                <span>{navbar.ordersSupportDetails}</span>
                <textarea className="feedbackDialogTextarea" value={supportDetails} onChange={(event) => setSupportDetails(event.target.value)} rows={4} maxLength={1000} disabled={supportSubmitting} placeholder={navbar.ordersSupportDetailsPlaceholder} />
              </label>
              {supportKind === "refund" ? <p className="rechargeSimulationNote">{navbar.ordersRefundPolicy}</p> : null}
              {supportError ? <p className="errorBox">{supportError}</p> : null}
              <ActionButton type="submit" variant="primary" fullWidth disabled={!supportReason.trim() || supportSubmitting}>
                {supportSubmitting ? navbar.submitting : navbar.ordersSupportSubmit}
              </ActionButton>
            </form>
          </Surface>
        </div>
      ) : null}
    </main>
  );
}

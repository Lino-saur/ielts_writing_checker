import { randomUUID } from "node:crypto";
import { db, ensureDatabase } from "./db";
import { sendEmail } from "./email";
import type { SupportInboxEntry, SupportInboxStatus } from "./types";

type SupportInboxRow = {
  id: string;
  resend_email_id: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string;
  text_content: string;
  html_content: string | null;
  status: SupportInboxStatus;
  reply_count: number;
  last_replied_at: Date | string | null;
  received_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  raw_payload_json: Record<string, unknown>;
};

type SupportReplyRow = {
  created_at: Date | string;
};

export type SupportInboxFilters = {
  status?: SupportInboxStatus | "all";
  q?: string;
  limit?: number;
};

type ParsedAddress = {
  email: string | null;
  name: string | null;
};

const EMAIL_RECEIVED_EVENT = "email.received";
const VERIFICATION_EMAIL_SUBJECT = "Verify your email for IELTS Writing Checker";
const NORMALIZED_VERIFICATION_EMAIL_SUBJECT = VERIFICATION_EMAIL_SUBJECT.toLowerCase();

export type SupportInboundIgnoreReason = "non_inbound_event" | "verification_email";

function mapSupportInboxRow(row: SupportInboxRow): SupportInboxEntry {
  return {
    id: row.id,
    resendEmailId: row.resend_email_id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    toEmail: row.to_email,
    subject: row.subject,
    textContent: row.text_content,
    htmlContent: row.html_content,
    status: row.status,
    replyCount: row.reply_count,
    lastRepliedAt: row.last_replied_at ? new Date(row.last_replied_at).toISOString() : null,
    receivedAt: new Date(row.received_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    rawPayload: row.raw_payload_json ?? {}
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAddress(value: unknown): ParsedAddress {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)(?:<([^>]+)>)$/);
    if (match) {
      const name = match[1]?.replace(/^"|"$/g, "").trim() || null;
      const email = match[2]?.trim() || null;
      return { email, name };
    }
    return trimmed.includes("@") ? { email: trimmed, name: null } : { email: null, name: trimmed || null };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseAddress(item);
      if (parsed.email) {
        return parsed;
      }
    }
  }

  if (isRecord(value)) {
    const email = getString(value.email) || getString(value.address) || null;
    const name = getString(value.name) || getString(value.display_name) || null;
    return { email, name };
  }

  return { email: null, name: null };
}

function pickPrimaryAddress(value: unknown) {
  const parsed = parseAddress(value);
  return parsed.email;
}

function extractEmailPayload(rawPayload: Record<string, unknown>) {
  const payload = isRecord(rawPayload.data)
    ? rawPayload.data
    : isRecord(rawPayload.email)
      ? rawPayload.email
      : rawPayload;

  const from = parseAddress(payload.from);
  const resendEmailId =
    getString(payload.id) || getString(payload.email_id) || getString(rawPayload.id) || getString(rawPayload.email_id) || null;
  const toEmail = pickPrimaryAddress(payload.to);
  const subject = getString(payload.subject) || "(no subject)";
  const textContent =
    getString(payload.text) ||
    getString(payload.text_body) ||
    getString(payload.textBody) ||
    getString(payload.plain_text) ||
    "";
  const htmlContent =
    getString(payload.html) || getString(payload.html_body) || getString(payload.htmlBody) || null;
  const receivedAtSource =
    getString(payload.received_at) ||
    getString(payload.created_at) ||
    getString(rawPayload.created_at) ||
    getString(rawPayload.received_at);
  const receivedAt = receivedAtSource ? new Date(receivedAtSource) : new Date();

  return {
    resendEmailId,
    fromEmail: from.email || "unknown@unknown.invalid",
    fromName: from.name,
    toEmail,
    subject,
    textContent,
    htmlContent,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt
  };
}

export function getSupportInboundIgnoreReason(
  rawPayload: Record<string, unknown>
): SupportInboundIgnoreReason | null {
  const eventType = getString(rawPayload.type).toLowerCase();

  // Resend can send delivery, sent and received events to the same webhook.
  // Only the received event represents a message sent to the support inbox.
  if (eventType && eventType !== EMAIL_RECEIVED_EVENT) {
    return "non_inbound_event";
  }

  const subject = extractEmailPayload(rawPayload).subject.trim().toLowerCase();
  if (subject === NORMALIZED_VERIFICATION_EMAIL_SUBJECT) {
    return "verification_email";
  }

  return null;
}

export async function ingestSupportInbound(rawPayload: Record<string, unknown>) {
  const ignoreReason = getSupportInboundIgnoreReason(rawPayload);
  if (ignoreReason) {
    return {
      ignored: true,
      reason: ignoreReason
    };
  }

  await ensureDatabase();
  const parsed = extractEmailPayload(rawPayload);
  const now = new Date().toISOString();
  const entryId = randomUUID();

  if (parsed.resendEmailId) {
    const existing = await db.query<{ id: string }>(
      `SELECT id
       FROM support_inbox_entries
       WHERE resend_email_id = $1
       LIMIT 1`,
      [parsed.resendEmailId]
    );

    if (existing.rows[0]) {
      await db.query(
        `UPDATE support_inbox_entries
         SET raw_payload_json = $2::jsonb,
             updated_at = $3
         WHERE id = $1`,
        [existing.rows[0].id, JSON.stringify(rawPayload), now]
      );

      return {
        id: existing.rows[0].id,
        duplicate: true
      };
    }
  }

  await db.query(
    `INSERT INTO support_inbox_entries (
      id,
      resend_email_id,
      from_email,
      from_name,
      to_email,
      subject,
      text_content,
      html_content,
      status,
      reply_count,
      last_replied_at,
      raw_payload_json,
      received_at,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', 0, NULL, $9::jsonb, $10, $11, $11)`,
    [
      entryId,
      parsed.resendEmailId,
      parsed.fromEmail,
      parsed.fromName,
      parsed.toEmail,
      parsed.subject,
      parsed.textContent,
      parsed.htmlContent,
      JSON.stringify(rawPayload),
      parsed.receivedAt.toISOString(),
      now
    ]
  );

  return {
    id: entryId,
    duplicate: false
  };
}

export async function listSupportInbox(filters: SupportInboxFilters = {}) {
  await ensureDatabase();

  // Keep verification messages that were stored before event filtering was
  // introduced out of both the list and its headline statistics.
  const params: Array<string | number> = [NORMALIZED_VERIFICATION_EMAIL_SUBJECT];
  const where: string[] = [`LOWER(BTRIM(subject)) <> $1`];
  const internalSenderEmails = [
    process.env.SUPPORT_EMAIL_FROM,
    process.env.AUTH_EMAIL_FROM,
    process.env.RESEND_FROM_EMAIL
  ]
    .map((value) => parseAddress(value).email?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  for (const senderEmail of new Set(internalSenderEmails)) {
    params.push(senderEmail);
    where.push(`LOWER(BTRIM(from_email)) <> $${params.length}`);
  }

  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    const patternRef = `$${params.length}`;
    where.push(`(
      from_email ILIKE ${patternRef}
      OR COALESCE(from_name, '') ILIKE ${patternRef}
      OR COALESCE(to_email, '') ILIKE ${patternRef}
      OR subject ILIKE ${patternRef}
      OR text_content ILIKE ${patternRef}
    )`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  params.push(limit);
  const limitRef = `$${params.length}`;
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [itemsResult, statsResult] = await Promise.all([
    db.query<SupportInboxRow>(
      `SELECT *
       FROM support_inbox_entries
       ${whereClause}
       ORDER BY received_at DESC
       LIMIT ${limitRef}`,
      params
    ),
    db.query<{
      total: string;
      new_count: string;
      reviewing_count: string;
      closed_count: string;
    }>(
      `SELECT
         COUNT(*)::TEXT AS total,
         COUNT(*) FILTER (WHERE status = 'new')::TEXT AS new_count,
         COUNT(*) FILTER (WHERE status = 'reviewing')::TEXT AS reviewing_count,
         COUNT(*) FILTER (WHERE status = 'closed')::TEXT AS closed_count
       FROM support_inbox_entries
       ${whereClause}`,
      params.slice(0, params.length - 1)
    )
  ]);

  const stats = statsResult.rows[0] || {
    total: "0",
    new_count: "0",
    reviewing_count: "0",
    closed_count: "0"
  };

  return {
    items: itemsResult.rows.map(mapSupportInboxRow),
    stats: {
      total: Number(stats.total || 0),
      newCount: Number(stats.new_count || 0),
      reviewingCount: Number(stats.reviewing_count || 0),
      closedCount: Number(stats.closed_count || 0)
    }
  };
}

export async function getSupportInboxEntryById(entryId: string) {
  await ensureDatabase();

  const result = await db.query<SupportInboxRow>(
    `SELECT *
     FROM support_inbox_entries
     WHERE id = $1
     LIMIT 1`,
    [entryId]
  );

  const row = result.rows[0];
  return row ? mapSupportInboxRow(row) : null;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function replyToSupportInboxEntry(input: {
  entryId: string;
  adminUserId: string;
  message: string;
}) {
  await ensureDatabase();

  const entry = await getSupportInboxEntryById(input.entryId);
  if (!entry) {
    throw new Error("SUPPORT_ENTRY_NOT_FOUND");
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error("SUPPORT_REPLY_EMPTY");
  }

  const fromAddress =
    process.env.SUPPORT_EMAIL_FROM?.trim() ||
    process.env.AUTH_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim();

  if (!fromAddress) {
    throw new Error("AUTH_EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  const html = message
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");

  const subject = entry.subject.toLowerCase().startsWith("re:") ? entry.subject : `Re: ${entry.subject}`;

  await sendEmail({
    from: fromAddress,
    to: entry.fromEmail,
    subject,
    text: message,
    html,
    replyTo: entry.toEmail || undefined
  });

  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO support_inbox_replies (
      id,
      entry_id,
      admin_user_id,
      to_email,
      subject,
      body_text,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), entry.id, input.adminUserId, entry.fromEmail, subject, message, now]
  );

  await db.query(
    `UPDATE support_inbox_entries
     SET status = 'reviewing',
         reply_count = reply_count + 1,
         last_replied_at = $2,
         updated_at = $2
     WHERE id = $1`,
    [entry.id, now]
  );

  return {
    ok: true,
    sentAt: now
  };
}

export async function listSupportInboxReplies(entryId: string) {
  await ensureDatabase();

  const result = await db.query<SupportReplyRow & { to_email: string; subject: string; body_text: string }>(
    `SELECT to_email, subject, body_text, created_at
     FROM support_inbox_replies
     WHERE entry_id = $1
     ORDER BY created_at DESC`,
    [entryId]
  );

  return result.rows.map((row) => ({
    toEmail: row.to_email,
    subject: row.subject,
    bodyText: row.body_text,
    createdAt: new Date(row.created_at).toISOString()
  }));
}

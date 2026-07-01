import { createHash } from "node:crypto";
import { db, ensureDatabase } from "./db";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
  }
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError("REQUEST_TOO_LARGE", 413);
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ApiError("REQUEST_TOO_LARGE", 413);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("INVALID_JSON", 400);
  }
}

export function requireBoundedString(
  value: unknown,
  field: string,
  options: { minLength?: number; maxLength: number }
) {
  if (typeof value !== "string") {
    throw new ApiError(`${field.toUpperCase()}_REQUIRED`, 400);
  }

  const normalized = value.trim();
  const minLength = options.minLength ?? 1;
  if (normalized.length < minLength) {
    throw new ApiError(`${field.toUpperCase()}_REQUIRED`, 400);
  }
  if (normalized.length > options.maxLength) {
    throw new ApiError(`${field.toUpperCase()}_TOO_LONG`, 413);
  }

  return normalized;
}

export function requireIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new ApiError("INVALID_IDEMPOTENCY_KEY", 400);
  }
  return value;
}

function hashSubject(subject: string) {
  return createHash("sha256").update(subject).digest("hex");
}

export async function enforceRateLimit(input: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}) {
  await ensureDatabase();

  const now = Date.now();
  const windowMs = input.windowSeconds * 1000;
  const bucketKey = Math.floor(now / windowMs);
  const result = await db.query<{ request_count: number }>(
    `INSERT INTO api_rate_limits (scope, subject, bucket_key, request_count, updated_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (scope, subject, bucket_key)
     DO UPDATE SET request_count = api_rate_limits.request_count + 1, updated_at = NOW()
     RETURNING request_count`,
    [input.scope, hashSubject(input.subject), bucketKey]
  );

  if (Number(result.rows[0]?.request_count || 0) > input.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucketKey + 1) * windowMs / 1000 - now / 1000));
    throw new ApiError("RATE_LIMITED", 429, retryAfterSeconds);
  }

  if (bucketKey % 100 === 0) {
    await db.query(`DELETE FROM api_rate_limits WHERE updated_at < NOW() - INTERVAL '24 hours'`);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds
    };
  }

  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNAUTHORIZED") {
    return { message, status: 401, retryAfterSeconds: undefined };
  }
  if (message === "INSUFFICIENT_ENERGY") {
    return { message, status: 402, retryAfterSeconds: undefined };
  }
  if (message === "REVIEW_IN_PROGRESS" || message === "REVIEW_REQUEST_FAILED") {
    return { message, status: 409, retryAfterSeconds: undefined };
  }
  if (
    message === "INVALID_TASK_IMAGE_OBJECT" ||
    message === "INVALID_IMAGE_TYPE" ||
    message === "INVALID_IMAGE_SIZE" ||
    message === "IMAGE_LOAD_FAILED"
  ) {
    return { message, status: 400, retryAfterSeconds: undefined };
  }
  if (message === "AI_REVIEW_FAILED") {
    return { message, status: 502, retryAfterSeconds: undefined };
  }
  if (message === "AI_REVIEW_TIMEOUT") {
    return { message, status: 504, retryAfterSeconds: undefined };
  }
  if (message === "REVIEW_IMAGE_STORAGE_NOT_CONFIGURED") {
    return { message, status: 503, retryAfterSeconds: undefined };
  }
  if (message === "MEDIA_UPLOAD_LIMIT_REACHED" || message === "MEDIA_UPLOADS_BLOCKED") {
    return { message, status: 429, retryAfterSeconds: undefined };
  }

  return { message: "INTERNAL_ERROR", status: 500, retryAfterSeconds: undefined };
}

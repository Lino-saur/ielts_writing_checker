import { createHash, createHmac } from "node:crypto";

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type SignedRequestInput = {
  method: "GET" | "PUT";
  key: string;
  body?: Buffer;
};

type PresignedPutUrlInput = {
  key: string;
  mimeType: string;
  expiresInSeconds?: number;
};

function getStorageConfig(): StorageConfig | null {
  const endpoint = process.env.REVIEW_IMAGE_STORAGE_ENDPOINT?.trim();
  const region = process.env.REVIEW_IMAGE_STORAGE_REGION?.trim();
  const bucket = process.env.REVIEW_IMAGE_STORAGE_BUCKET?.trim();
  const accessKeyId = process.env.REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey
  };
}

function sha256Hex(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function createSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodeUriComponentStrict(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildSignedHeaders(input: SignedRequestInput, config: StorageConfig) {
  const endpointUrl = new URL(config.endpoint);
  const now = new Date();
  const isoString = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amzDate = `${isoString.slice(0, 8)}T${isoString.slice(9, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const key = encodeObjectKey(input.key);
  const pathname = `/${config.bucket}/${key}`;
  const payloadHash = input.body ? sha256Hex(input.body) : sha256Hex("");
  const canonicalHeaders = `host:${endpointUrl.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    input.method,
    pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = createSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    url: new URL(pathname, endpointUrl).toString(),
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    }
  };
}

async function createStorageRequest(input: SignedRequestInput) {
  const config = getStorageConfig();

  if (!config) {
    throw new Error("REVIEW_IMAGE_STORAGE_NOT_CONFIGURED");
  }

  return buildSignedHeaders(input, config);
}

function buildResponseErrorText(status: number, body: string) {
  const preview = body.trim().slice(0, 240);
  return `OBJECT_STORAGE_${status}${preview ? `: ${preview}` : ""}`;
}

export function isReviewImageStorageConfigured() {
  return Boolean(getStorageConfig());
}

export async function putReviewImageObject(key: string, body: Buffer, mimeType: string) {
  const request = await createStorageRequest({
    method: "PUT",
    key,
    body
  });

  const response = await fetch(request.url, {
    method: "PUT",
    headers: {
      ...request.headers,
      "Content-Length": String(body.byteLength),
      "Content-Type": mimeType
    },
    body
  });

  if (!response.ok) {
    throw new Error(buildResponseErrorText(response.status, await response.text()));
  }
}

export async function getReviewImageObject(key: string) {
  const request = await createStorageRequest({
    method: "GET",
    key
  });

  const response = await fetch(request.url, {
    method: "GET",
    headers: request.headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(buildResponseErrorText(response.status, await response.text()));
  }

  return response;
}

export function createPresignedReviewImageUploadUrl(input: PresignedPutUrlInput) {
  const config = getStorageConfig();

  if (!config) {
    throw new Error("REVIEW_IMAGE_STORAGE_NOT_CONFIGURED");
  }

  const endpointUrl = new URL(config.endpoint);
  const now = new Date();
  const isoString = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amzDate = `${isoString.slice(0, 8)}T${isoString.slice(9, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const encodedKey = encodeObjectKey(input.key);
  const canonicalUri = `/${config.bucket}/${encodedKey}`;
  const expires = Math.min(Math.max(input.expiresInSeconds ?? 900, 60), 3600);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "content-type;host"
  });
  const canonicalQueryString = [
    `X-Amz-Algorithm=${encodeUriComponentStrict(query.get("X-Amz-Algorithm") || "")}`,
    `X-Amz-Credential=${encodeUriComponentStrict(query.get("X-Amz-Credential") || "")}`,
    `X-Amz-Date=${encodeUriComponentStrict(query.get("X-Amz-Date") || "")}`,
    `X-Amz-Expires=${encodeUriComponentStrict(query.get("X-Amz-Expires") || "")}`,
    `X-Amz-SignedHeaders=${encodeUriComponentStrict(query.get("X-Amz-SignedHeaders") || "")}`
  ].join("&");
  const canonicalHeaders = `content-type:${input.mimeType}\nhost:${endpointUrl.host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    "content-type;host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = createSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const uploadUrl = new URL(canonicalUri, endpointUrl);

  uploadUrl.search = `${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return {
    uploadUrl: uploadUrl.toString(),
    headers: {
      "Content-Type": input.mimeType
    }
  };
}

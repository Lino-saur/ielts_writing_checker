import pg from "pg";
import { createHash, createHmac } from "node:crypto";

const { Pool } = pg;

const BASE_URL = "https://liuxue.koolearn.com";
const INDEX_URL = `${BASE_URL}/ielts/write-0-0-0/`;
const MIN_BOOK_NUMBER = 5;
const MAX_BOOK_NUMBER = 21;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...valueParts] = arg.slice(2).split("=");
      return [key, valueParts.join("=")];
    })
);
const onlyBookNumber = args.has("book") ? Number(args.get("book")) : null;
const onlyQuestionName = args.get("question")?.trim().toUpperCase() ?? null;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl:
    process.env.POSTGRES_SSL === "false"
      ? false
      : process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

function getStorageConfig() {
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

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function extractNextData(html, url) {
  const match = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Could not find __NEXT_DATA__ in ${url}.`);
  }

  return JSON.parse(match[1]);
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function createSigningKey(secretAccessKey, dateStamp, region) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodeObjectKey(key) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildSignedPutRequest(config, key, body) {
  const endpointUrl = new URL(config.endpoint);
  const now = new Date();
  const isoString = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amzDate = `${isoString.slice(0, 8)}T${isoString.slice(9, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const pathname = `/${config.bucket}/${encodeObjectKey(key)}`;
  const payloadHash = sha256Hex(body);
  const canonicalHeaders = `host:${endpointUrl.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
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

function toAbsoluteUrl(url) {
  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("/")) {
    return `${BASE_URL}${url}`;
  }

  return url;
}

function sanitizeObjectKeySegment(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-");
}

function extensionFromMimeType(mimeType) {
  if (mimeType.includes("png")) {
    return ".png";
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return ".jpg";
  }
  if (mimeType.includes("webp")) {
    return ".webp";
  }
  if (mimeType.includes("gif")) {
    return ".gif";
  }

  return "";
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\.(png|jpe?g|webp|gif)$/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : "";
}

function stripHtmlToText(html) {
  return decodeHtml(
    html
      .replace(/<img\b[^>]*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function collectQuestionNodes(value, output = []) {
  if (!value || typeof value !== "object") {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectQuestionNodes(item, output);
    }
    return output;
  }

  if (
    typeof value.questionName === "string" &&
    typeof value.writeQuestionType === "string" &&
    typeof value.id === "number"
  ) {
    output.push(value);
  }

  for (const child of Object.values(value)) {
    collectQuestionNodes(child, output);
  }

  return output;
}

function normalizeTaskType(writeQuestionType) {
  return writeQuestionType === "Task 1" ? "task1" : writeQuestionType === "Task 2" ? "task2" : null;
}

function parseQuestionName(questionName) {
  const match = questionName.match(/^C(\d+)[-_]T(\d+)[-_]T([12])$/);
  if (!match) {
    return null;
  }

  return {
    bookNumber: Number(match[1]),
    testNumber: Number(match[2]),
    taskType: match[3] === "1" ? "task1" : "task2"
  };
}

function formatQuestionName(parsed) {
  return `C${parsed.bookNumber}-T${parsed.testNumber}-T${parsed.taskType === "task1" ? "1" : "2"}`;
}

function buildTitle(question) {
  const parsed = parseQuestionName(question.questionName);
  return parsed ? formatQuestionName(parsed) : question.questionName;
}

function buildTags(question) {
  return [...new Set([question.writeQuestionCategory, question.writeQuestionSubject].filter(Boolean))];
}

function buildMetadata(question, storedImages) {
  return {
    koolearnId: question.id,
    questionCode: question.questionCode ?? null,
    originalQuestionName: question.questionName ?? null,
    normalizedQuestionName: parseQuestionName(question.questionName ?? "")
      ? formatQuestionName(parseQuestionName(question.questionName))
      : null,
    questionSource: question.questionSource ?? null,
    writeQuestionType: question.writeQuestionType ?? null,
    writeQuestionCategory: question.writeQuestionCategory ?? null,
    writeQuestionSubject: question.writeQuestionSubject ?? null,
    storedImages,
    sourceNotice: "Imported from Koolearn with site owner authorization. Task 1 images are copied to R2."
  };
}

function extractQuestionDetail(html, url) {
  const data = extractNextData(html, url);
  const detail = data?.props?.pageProps?.questionInfo?.question?.question;
  const rawStem = typeof detail?.stem === "string" ? detail.stem : "";
  const promptText = stripHtmlToText(rawStem);
  const imageUrls = Array.isArray(detail?.imgUrl)
    ? detail.imgUrl.map(toAbsoluteUrl).filter(Boolean)
    : [];

  return {
    promptText,
    imageUrls
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "user-agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function putObject(config, key, body, mimeType) {
  const request = buildSignedPutRequest(config, key, body);
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
    throw new Error(`Failed to upload ${key}: ${response.status} ${(await response.text()).slice(0, 240)}`);
  }
}

async function downloadAndStoreImage(config, recordId, imageUrl, index) {
  const response = await fetch(imageUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "user-agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${imageUrl}: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const extension = extensionFromMimeType(mimeType) || extensionFromUrl(imageUrl);
  const fileName = `source-image-${index + 1}${extension}`;
  const objectKey = `practice-questions/${sanitizeObjectKeySegment(recordId)}/${fileName}`;

  await putObject(config, objectKey, bytes, mimeType);

  return {
    objectKey,
    name: fileName,
    mimeType,
    sizeBytes: bytes.byteLength,
    sourceUrl: imageUrl
  };
}

async function storeQuestionImages(recordId, imageUrls) {
  if (!imageUrls.length) {
    return [];
  }

  const config = getStorageConfig();
  if (!config) {
    throw new Error("REVIEW_IMAGE_STORAGE_* variables are required to import Koolearn images into R2.");
  }

  const storedImages = [];
  for (const [index, imageUrl] of imageUrls.entries()) {
    storedImages.push(await downloadAndStoreImage(config, recordId, imageUrl, index));
  }

  return storedImages;
}

async function ensurePracticeTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS practice_questions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT 'academic',
      book_number INTEGER NOT NULL,
      test_number INTEGER NOT NULL,
      task_type TEXT NOT NULL,
      title TEXT NOT NULL,
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      prompt_text TEXT NOT NULL DEFAULT '',
      source_ref TEXT,
      source_url TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      image_source_url TEXT,
      image_source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      image_object_key TEXT,
      image_name TEXT,
      image_mime_type TEXT,
      image_size_bytes BIGINT,
      content_status TEXT NOT NULL DEFAULT 'placeholder',
      status TEXT NOT NULL DEFAULT 'draft',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'academic';
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS source_ref TEXT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS source_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS image_source_url TEXT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS image_source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS content_status TEXT NOT NULL DEFAULT 'placeholder';
  `);

  await pool.query(`
    ALTER TABLE practice_questions
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS practice_questions_source_module_book_test_task_idx
    ON practice_questions (source, module, book_number, test_number, task_type);
  `);
}

async function upsertQuestion(question, detail) {
  const parsed = parseQuestionName(question.questionName);
  const taskType = normalizeTaskType(question.writeQuestionType);

  if (!parsed || !taskType || parsed.taskType !== taskType) {
    return false;
  }

  const id = `cambridge_ielts_${parsed.bookNumber}_test_${parsed.testNumber}_${taskType}`;
  const sourceUrl = `${BASE_URL}/ielts/write/${question.id}.html`;
  const sortOrder = parsed.bookNumber * 100 + parsed.testNumber * 10 + (taskType === "task1" ? 1 : 2);
  const promptText = detail.promptText || stripHtmlToText(question.writeQuestionStem ?? "");
  const imageUrls = detail.imageUrls ?? [];
  const storedImages = await storeQuestionImages(id, imageUrls);
  const primaryImage = storedImages[0] ?? null;

  await pool.query(
    `INSERT INTO practice_questions (
       id,
       source,
       module,
       book_number,
       test_number,
       task_type,
       title,
       tags_json,
       prompt_text,
       source_ref,
       source_url,
       metadata_json,
       image_source_url,
       image_source_urls_json,
       image_object_key,
       image_name,
       image_mime_type,
       image_size_bytes,
       content_status,
       status,
       sort_order,
       created_at,
       updated_at
     )
     VALUES (
       $1, 'cambridge_ielts', 'academic', $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb,
       $11, $12::jsonb, $13, $14, $15, $16, 'complete', 'published', $17, NOW(), NOW()
     )
     ON CONFLICT (source, module, book_number, test_number, task_type)
     DO UPDATE SET
       title = EXCLUDED.title,
       tags_json = EXCLUDED.tags_json,
       prompt_text = EXCLUDED.prompt_text,
       source_ref = EXCLUDED.source_ref,
       source_url = EXCLUDED.source_url,
       metadata_json = EXCLUDED.metadata_json,
       image_source_url = EXCLUDED.image_source_url,
       image_source_urls_json = EXCLUDED.image_source_urls_json,
       image_object_key = EXCLUDED.image_object_key,
       image_name = EXCLUDED.image_name,
       image_mime_type = EXCLUDED.image_mime_type,
       image_size_bytes = EXCLUDED.image_size_bytes,
       content_status = 'complete',
       status = 'published',
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()`,
    [
      id,
      parsed.bookNumber,
      parsed.testNumber,
      taskType,
      buildTitle(question),
      JSON.stringify(buildTags(question)),
      promptText,
      question.questionSource ?? question.questionCode ?? null,
      sourceUrl,
      JSON.stringify(buildMetadata(question, storedImages)),
      imageUrls[0] ?? null,
      JSON.stringify(imageUrls),
      primaryImage?.objectKey ?? null,
      primaryImage?.name ?? null,
      primaryImage?.mimeType ?? null,
      primaryImage?.sizeBytes ?? null,
      sortOrder
    ]
  );

  return true;
}

try {
  getRequiredEnv("DATABASE_URL");
  await ensurePracticeTable();

  const indexHtml = await fetchHtml(INDEX_URL);
  const indexData = extractNextData(indexHtml, INDEX_URL);
  const seenQuestionIds = new Set();
  const questions = collectQuestionNodes(indexData)
    .filter((question) => {
      const parsed = parseQuestionName(question.questionName ?? "");
      if (
        !parsed ||
        parsed.bookNumber < MIN_BOOK_NUMBER ||
        parsed.bookNumber > MAX_BOOK_NUMBER
      ) {
        return false;
      }
      if (onlyBookNumber !== null && parsed.bookNumber !== onlyBookNumber) {
        return false;
      }
      if (onlyQuestionName && formatQuestionName(parsed) !== onlyQuestionName) {
        return false;
      }
      if (seenQuestionIds.has(question.id)) {
        return false;
      }

      seenQuestionIds.add(question.id);

      return true;
    })
    .sort((left, right) => {
      const leftParsed = parseQuestionName(left.questionName);
      const rightParsed = parseQuestionName(right.questionName);
      if (!leftParsed || !rightParsed) {
        return 0;
      }

      return (
        leftParsed.bookNumber - rightParsed.bookNumber ||
        leftParsed.testNumber - rightParsed.testNumber ||
        (leftParsed.taskType === "task1" ? 1 : 2) - (rightParsed.taskType === "task1" ? 1 : 2)
      );
    });
  let syncedCount = 0;

  for (const question of questions) {
    const sourceUrl = `${BASE_URL}/ielts/write/${question.id}.html`;
    const detail = extractQuestionDetail(await fetchHtml(sourceUrl), sourceUrl);
    if (await upsertQuestion(question, detail)) {
      syncedCount += 1;
    }
  }

  console.log(`Synced ${syncedCount} Koolearn Cambridge IELTS practice records.`);
  console.log("Prompt text was stored in Postgres. Task 1 images were copied to R2 and linked by image_object_key.");
} finally {
  await pool.end();
}

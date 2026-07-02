import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const INDEX_URL = "https://liuxue.koolearn.com/ielts/write-1-0-0/";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const APPLY = process.argv.includes("--apply");
const taskArg = process.argv.find((arg) => arg.startsWith("--task="))?.slice("--task=".length);
const TASK_FILTER = taskArg === "task1" || taskArg === "task2" ? taskArg : "all";
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const sourcePath = sourceArg?.slice("--source=".length) || null;

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Production and CI environments normally inject DATABASE_URL directly.
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
  ssl:
    process.env.POSTGRES_SSL === "false"
      ? false
      : process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});
pool.on("error", (error) => {
  console.warn(`Database pool connection closed: ${error.message}`);
});

async function queryWithRetry(text, values) {
  try {
    return await pool.query(text, values);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/connection|socket|terminated|econnreset/i.test(message)) throw error;
    return pool.query(text, values);
  }
}

function getStorageConfig() {
  const endpoint = process.env.REVIEW_IMAGE_STORAGE_ENDPOINT?.trim();
  const region = process.env.REVIEW_IMAGE_STORAGE_REGION?.trim();
  const bucket = process.env.REVIEW_IMAGE_STORAGE_BUCKET?.trim();
  const accessKeyId = process.env.REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY?.trim();
  return endpoint && region && bucket && accessKeyId && secretAccessKey
    ? { endpoint, region, bucket, accessKeyId, secretAccessKey }
    : null;
}

function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function encodeObjectKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function buildSignedPutRequest(config, key, body) {
  const endpointUrl = new URL(config.endpoint);
  const now = new Date();
  const isoString = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amzDate = `${isoString.slice(0, 8)}T${isoString.slice(9, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const pathname = `/${config.bucket}/${encodeObjectKey(key)}`;
  const payloadHash = sha256Hex(body);
  const canonicalHeaders =
    `host:${endpointUrl.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
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
  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  const signingKey = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    url: new URL(pathname, endpointUrl).toString(),
    headers: {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    }
  };
}

function toAbsoluteUrl(value) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return new URL(value, INDEX_URL).toString();
  return value;
}

function imageExtension(mimeType, url) {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  const match = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".img";
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "user-agent": USER_AGENT
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function getTask1Images(questionId) {
  const detailUrl = `https://liuxue.koolearn.com/ielts/write/${questionId}.html`;
  const detail = extractNextData(await fetchHtml(detailUrl))
    ?.props?.pageProps?.questionInfo?.question?.question;
  return Array.isArray(detail?.imgUrl)
    ? detail.imgUrl.map(toAbsoluteUrl).filter(Boolean)
    : [];
}

async function uploadTask1Images(question, imageUrls) {
  const config = getStorageConfig();
  if (!config) throw new Error("REVIEW_IMAGE_STORAGE_* variables are required.");

  const stored = [];
  for (const [index, imageUrl] of imageUrls.entries()) {
    const response = await fetch(imageUrl, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "user-agent": USER_AGENT
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${imageUrl}: ${response.status}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";
    const name = `source-image-${index + 1}${imageExtension(mimeType, imageUrl)}`;
    const objectKey = `historical-practice/${question.id}/${name}`;
    const signed = buildSignedPutRequest(config, objectKey, body);
    const upload = await fetch(signed.url, {
      method: "PUT",
      headers: {
        ...signed.headers,
        "Content-Length": String(body.byteLength),
        "Content-Type": mimeType
      },
      body
    });
    if (!upload.ok) {
      throw new Error(`Failed to upload ${objectKey}: ${upload.status}`);
    }
    stored.push({ objectKey, name, mimeType, sizeBytes: body.byteLength, sourceUrl: imageUrl });
  }
  return stored;
}

const STOP_WORDS = new Set([
  "about", "after", "also", "among", "and", "are", "been", "being", "believe",
  "both", "but", "can", "could", "disagree", "discuss", "does", "doing", "each",
  "example", "examples", "extent", "for", "from", "give", "has", "have", "how",
  "include", "into", "its", "knowledge", "least", "many", "more", "most", "much",
  "now", "nowadays", "often", "one", "only", "opinion", "other", "others", "our",
  "own", "people", "reasons", "relevant", "should", "some", "than", "that", "the",
  "their", "them", "there", "these", "they", "think", "this", "those", "what",
  "when", "where", "which", "while", "who", "why", "will", "with", "words",
  "world", "would", "write", "your"
]);

function extractNextData(html) {
  const match = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Could not find __NEXT_DATA__ in Koolearn page.");
  }
  return JSON.parse(match[1]);
}

function cleanPrompt(value) {
  return String(value ?? "")
    .replace(
      /\s*Give reasons for your answer and include any relevant examples from your own knowledge or experience\.\s*/gi,
      " "
    )
    .replace(/\s*Write at least (?:150|250) words\.?\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalPrompt(value) {
  return cleanPrompt(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, "");
}

function stemToken(token) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function tokenize(value) {
  const words = cleanPrompt(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .match(/[a-z0-9]+/g) ?? [];
  return words
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stemToken);
}

function tokenJaccard(left, right) {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function inferQuestionType(prompt) {
  const text = prompt.toLowerCase();
  if (text.includes("discuss both")) return "讨论类";

  const asksReason =
    text.includes("what are the reasons") ||
    text.includes("what are reasons") ||
    text.includes("why is") ||
    text.includes("why do") ||
    text.includes("why are");
  const questionCount = (text.match(/\?/g) ?? []).length;
  const asksEvaluation =
    text.includes("positive or negative") ||
    /advantages.{0,100}outweigh/.test(text) ||
    text.includes("advantages or disadvantages");
  if (asksReason && (asksEvaluation || questionCount >= 2)) return "混合类";

  if (
    text.includes("agree or disagree") ||
    /agree.{0,20}disagree/.test(text) ||
    text.includes("to what extent") ||
    text.includes("do you agree") ||
    /advantages.{0,100}outweigh/.test(text) ||
    text.includes("positive or negative") ||
    text.includes("advantages and disadvantages")
  ) {
    return "观点类";
  }

  if (
    asksReason ||
    text.includes("what can be done") ||
    text.includes("how can") ||
    text.includes("solution") ||
    text.includes("solve this problem") ||
    text.includes("what problems")
  ) {
    return "问题解决类";
  }
  return "混合类";
}

function inferStrongCategory(prompt) {
  const text = prompt.toLowerCase();
  const rules = [
    {
      category: "环境类",
      pattern: /\b(climate change|global environmental|pollution|protecting wild animals)\b/
    },
    {
      category: "旅游类",
      pattern: /\b(visit other countries|tourism|tourists)\b/
    },
    {
      category: "媒体类",
      pattern: /\b(celebrities|newspapers?|news programmes?|advertising|the media)\b/
    },
    {
      category: "国际化",
      pattern: /\b(western-style clothes|traditional clothes|international cooperation)\b/
    },
    {
      category: "成功类",
      pattern: /\b(goal in life|question of luck)\b/
    },
    {
      category: "生活类",
      pattern: /\b(expect to get what they want instantly)\b/
    },
    {
      category: "交通类",
      pattern: /\b(traffic congestion|road safety|public transport)\b/
    }
  ];
  return rules.find((rule) => rule.pattern.test(text))?.category ?? null;
}

function inferTask1Category(prompt) {
  const text = prompt.toLowerCase();
  if (
    /\b(map|maps|plan|plans|layout|site)\b/.test(text) ||
    /\bdiagrams?\b.*\b(changed|changes|before and after|ago and now|office|park|coastal)\b/.test(text)
  ) {
    return "地图";
  }
  if (
    /\b(process|life cycle)\b/.test(text) ||
    /\bdiagrams?\b/.test(text) ||
    /\bhow .* (?:is|are) (?:made|produced|recycled|collected|designed|works)\b/.test(text)
  ) {
    return "流程图";
  }
  if (
    /\b(table and (?:graph|chart)|(?:graph|chart) and (?:table|pie chart)|mixed charts?)\b/.test(text)
  ) {
    return "混合图";
  }
  if (/\bpie charts?\b/.test(text)) return "饼状图";
  if (/\btables?\b/.test(text)) return "表格";
  if (/\b(line graphs?|line charts?|graphs?)\b/.test(text)) return "曲线图";
  if (/\b(bar charts?|bar graphs?|charts?)\b/.test(text)) return "柱状图";
  return "混合图";
}

function parseSourceQuestions(html) {
  const data = extractNextData(html);
  const groups = data?.props?.pageProps?.practiceData?.list;
  if (!Array.isArray(groups)) {
    throw new Error("Koolearn practice list is missing.");
  }

  const questions = groups.flatMap((group) => {
    const date = String(group.date ?? "").replaceAll("/", "-");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(group.children)) {
      return [];
    }

    return group.children
      .filter(
        (question) =>
          question.writeQuestionType === "Task 1" ||
          question.writeQuestionType === "Task 2"
      )
      .map((question) => ({
        koolearnId: Number(question.id),
        date,
        year: Number(date.slice(0, 4)),
        taskType: question.writeQuestionType === "Task 1" ? "task1" : "task2",
        prompt: cleanPrompt(question.writeQuestionStem)
      }))
      .filter(
        (question) =>
          Number.isInteger(question.koolearnId) &&
          question.prompt.length >= 10
      );
  });

  const unique = new Map();
  for (const question of questions) {
    unique.set(
      `${question.taskType}:${question.date}:${canonicalPrompt(question.prompt)}`,
      question
    );
  }
  return [...unique.values()];
}

function makeTermFrequency(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function createCategoryClassifier(existingQuestions) {
  const tokenized = existingQuestions.map((question) => tokenize(question.prompt));
  const documentFrequency = new Map();
  for (const tokens of tokenized) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const documentCount = existingQuestions.length;

  function vectorize(tokens) {
    const frequency = makeTermFrequency(tokens);
    const vector = new Map();
    let normSquared = 0;
    for (const [token, count] of frequency) {
      const inverseDocumentFrequency = Math.log(
        (documentCount + 1) / ((documentFrequency.get(token) ?? 0) + 1)
      ) + 1;
      const weight = (1 + Math.log(count)) * inverseDocumentFrequency;
      vector.set(token, weight);
      normSquared += weight * weight;
    }
    return { vector, norm: Math.sqrt(normSquared) };
  }

  const existingVectors = tokenized.map(vectorize);
  return (prompt) => {
    const strongCategory = inferStrongCategory(prompt);
    if (strongCategory) {
      return {
        category: strongCategory,
        confidence: 1,
        method: "existing_taxonomy_rule",
        neighbors: []
      };
    }

    const exact = existingQuestions.find(
      (question) => canonicalPrompt(question.prompt) === canonicalPrompt(prompt)
    );
    if (exact) {
      return {
        category: exact.category,
        confidence: 1,
        method: "exact_prompt",
        neighbors: [{ id: exact.id, category: exact.category, score: 1 }]
      };
    }

    const target = vectorize(tokenize(prompt));
    const scored = existingQuestions.map((question, index) => {
      const candidate = existingVectors[index];
      let dotProduct = 0;
      for (const [token, weight] of target.vector) {
        dotProduct += weight * (candidate.vector.get(token) ?? 0);
      }
      return {
        id: question.id,
        category: question.category,
        prompt: question.prompt,
        score:
          target.norm && candidate.norm
            ? dotProduct / (target.norm * candidate.norm)
            : 0
      };
    }).sort((left, right) => right.score - left.score);

    const neighbors = scored.slice(0, 7);
    const categoryScores = new Map();
    for (const neighbor of neighbors) {
      const weight = Math.pow(neighbor.score, 3);
      categoryScores.set(
        neighbor.category,
        (categoryScores.get(neighbor.category) ?? 0) + weight
      );
    }
    const rankedCategories = [...categoryScores.entries()].sort(
      (left, right) => right[1] - left[1]
    );
    const totalWeight = rankedCategories.reduce((sum, [, score]) => sum + score, 0);
    return {
      category: rankedCategories[0]?.[0] ?? "社会类",
      confidence: totalWeight ? (rankedCategories[0]?.[1] ?? 0) / totalWeight : 0,
      method: "existing_taxonomy_knn",
      neighbors: neighbors.slice(0, 3)
    };
  };
}

async function loadSourceHtml() {
  if (sourcePath) {
    return readFile(sourcePath, "utf8");
  }
  const response = await fetch(INDEX_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "user-agent": USER_AGENT
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Koolearn page: ${response.status}`);
  }
  return response.text();
}

async function importTask1Question(question) {
  const imageUrls = await getTask1Images(question.koolearnId);
  if (!imageUrls.length) {
    throw new Error(`Task 1 question ${question.koolearnId} has no source image.`);
  }
  const storedImages = await uploadTask1Images(question, imageUrls);
  const primary = storedImages[0];
  await queryWithRetry(
    `INSERT INTO historical_practice_questions (
       id, year, exam_date, task_type, category, question_type, prompt,
       image_source_urls_json, image_object_key, image_name, image_mime_type,
       image_size_bytes, created_at, updated_at
     )
     VALUES ($1, $2, $3, 'task1', $4, NULL, $5, $6::jsonb, $7, $8, $9, $10, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       category = EXCLUDED.category,
       prompt = EXCLUDED.prompt,
       image_source_urls_json = EXCLUDED.image_source_urls_json,
       image_object_key = EXCLUDED.image_object_key,
       image_name = EXCLUDED.image_name,
       image_mime_type = EXCLUDED.image_mime_type,
       image_size_bytes = EXCLUDED.image_size_bytes,
       updated_at = NOW()`,
    [
      question.id,
      question.year,
      question.date,
      question.category,
      question.prompt,
      JSON.stringify(imageUrls),
      primary.objectKey,
      primary.name,
      primary.mimeType,
      primary.sizeBytes
    ]
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const sourceQuestions = parseSourceQuestions(await loadSourceHtml()).filter(
    (question) => TASK_FILTER === "all" || question.taskType === TASK_FILTER
  );
  const existingResult = await pool.query(
    `SELECT id, task_type, exam_date::text AS date, category, question_type AS type, prompt
     FROM historical_practice_questions
     ORDER BY exam_date, id`
  );
  const existingQuestions = existingResult.rows.filter(
    (question) => TASK_FILTER === "all" || question.task_type === TASK_FILTER
  );
  const byDate = new Map();
  for (const question of existingQuestions) {
    const key = `${question.task_type}:${question.date}`;
    const candidates = byDate.get(key) ?? [];
    candidates.push(question);
    byDate.set(key, candidates);
  }

  const matched = [];
  const missingSource = [];
  for (const source of sourceQuestions) {
    const candidates = byDate.get(`${source.taskType}:${source.date}`) ?? [];
    const exact = candidates.find(
      (candidate) => canonicalPrompt(candidate.prompt) === canonicalPrompt(source.prompt)
    );
    if (exact) {
      matched.push({ source, databaseId: exact.id, method: "exact", score: 1 });
      continue;
    }
    const scored = candidates
      .map((candidate) => ({
        candidate,
        score: tokenJaccard(source.prompt, candidate.prompt)
      }))
      .sort((left, right) => right.score - left.score);
    if (scored[0]?.score >= 0.6 || candidates.length > 0) {
      matched.push({
        source,
        databaseId: scored[0].candidate.id,
        method: scored[0]?.score >= 0.6 ? "fuzzy" : "date",
        score: scored[0]?.score ?? 0
      });
    } else {
      missingSource.push({
        ...source,
        sameDateCandidates: scored.slice(0, 3)
      });
    }
  }

  const classifyCategory = createCategoryClassifier(
    existingResult.rows.filter((question) => question.task_type === "task2")
  );
  const missing = missingSource.map((source) => {
    const classification =
      source.taskType === "task2"
        ? classifyCategory(source.prompt)
        : {
            category: inferTask1Category(source.prompt),
            confidence: 1,
            method: "task1_prompt_rule",
            neighbors: []
          };
    return {
      id: `koolearn_historical_${source.taskType}_${source.koolearnId}_${createHash("sha256")
        .update(`${source.date}:${canonicalPrompt(source.prompt)}`)
        .digest("hex")
        .slice(0, 8)}`,
      koolearnId: source.koolearnId,
      date: source.date,
      year: source.year,
      taskType: source.taskType,
      prompt: source.prompt,
      type: source.taskType === "task2" ? inferQuestionType(source.prompt) : null,
      category: classification.category,
      categoryConfidence: classification.confidence,
      categoryMethod: classification.method,
      categoryNeighbors: classification.neighbors,
      sameDateCandidates: source.sameDateCandidates
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sourceUrl: INDEX_URL,
    taskFilter: TASK_FILTER,
    sourceQuestions: sourceQuestions.length,
    databaseBefore: existingQuestions.length,
    matched: matched.length,
    fuzzyMatched: matched.filter((item) => item.method === "fuzzy").length,
    dateMatched: matched.filter((item) => item.method === "date").length,
    missing: missing.length,
    applied: APPLY,
    missingItems: missing
  };
  await mkdir(".data", { recursive: true });
  await writeFile(
    ".data/koolearn-historical-sync-report.json",
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  if (APPLY && missing.length) {
    const task2Missing = missing.filter((question) => question.taskType === "task2");
    if (task2Missing.length) {
      await pool.query(
        `INSERT INTO historical_practice_questions (
           id, year, exam_date, task_type, category, question_type, prompt, created_at, updated_at
         )
         SELECT id, year, exam_date, 'task2', category, question_type, prompt, NOW(), NOW()
         FROM jsonb_to_recordset($1::jsonb) AS source(
           id TEXT,
           year INTEGER,
           exam_date DATE,
           category TEXT,
           question_type TEXT,
           prompt TEXT
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          JSON.stringify(
            task2Missing.map((question) => ({
              id: question.id,
              year: question.year,
              exam_date: question.date,
              category: question.category,
              question_type: question.type,
              prompt: question.prompt
            }))
          )
        ]
      );
    }

    const task1Missing = missing.filter((question) => question.taskType === "task1");
    for (const [index, question] of task1Missing.entries()) {
      await importTask1Question(question);
      if ((index + 1) % 10 === 0 || index + 1 === task1Missing.length) {
        console.log(`Imported Task 1 images: ${index + 1}/${task1Missing.length}`);
      }
    }
  }

  const afterResult = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM historical_practice_questions
     WHERE $1 = 'all' OR task_type = $1`,
    [TASK_FILTER]
  );
  console.log(
    JSON.stringify({
      sourceQuestions: report.sourceQuestions,
      taskFilter: TASK_FILTER,
      databaseBefore: report.databaseBefore,
      matched: report.matched,
      fuzzyMatched: report.fuzzyMatched,
      dateMatched: report.dateMatched,
      missing: report.missing,
      applied: APPLY,
      databaseAfter: afterResult.rows[0]?.count ?? 0,
      report: ".data/koolearn-historical-sync-report.json"
    })
  );
}

main()
  .catch((error) => {
    console.error(
      "Koolearn historical question sync failed.",
      error instanceof Error ? error.message : "UNKNOWN_ERROR"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

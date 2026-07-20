# IELTS Writing Checker

AI-powered IELTS writing checker for Task 1 and Task 2 with rubric-based scoring, inline revisions, user-bound energy, and Better Auth sessions.

## What It Does

- Accepts an IELTS prompt and essay response.
- Supports both `Task 1` and `Task 2`.
- Returns an estimated band score with the four IELTS criteria:
  - Task Achievement
  - Coherence and Cohesion
  - Lexical Resource
  - Grammatical Range and Accuracy
- Shows strengths, highlighted sentences, priority fixes, and inline revisions.
- Saves a per-user review history with the original prompt, essay, and Task 1 image.
- Uploads Task 1 images directly from the browser to object storage using a short-lived signed URL.
- Binds review energy to a Better Auth user session.
- Keeps signed-in sessions in a persistent auth cookie for up to 30 days unless the user signs out.
- Uses `Qianwen` for Task 1 image understanding and Task 1/Task 2 scoring and revision feedback.

## Stack

- Next.js 15
- React 19
- TypeScript
- Better Auth
- PostgreSQL

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env.local`:

```env
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-5.4
OPENAI_REASONING_EFFORT=medium

QIANWEN_API_KEY=your_qianwen_key_here
QIANWEN_MODEL=qwen3.7-plus
# Optional full chat-completions URL. It must match the API key's Model Studio region.
QIANWEN_API_ENDPOINT=https://<workspace-id>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions
AI_REQUEST_TIMEOUT_MS=45000
AI_GRAMMAR_REQUEST_TIMEOUT_MS=120000
AI_VISION_REQUEST_TIMEOUT_MS=120000
AI_DEBUG_LOGS=false

BETTER_AUTH_SECRET=your_long_random_secret
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=your_resend_api_key
AUTH_EMAIL_FROM=IELTS Writing Checker <no-reply@example.com>
SUPPORT_EMAIL_FROM=IELTS Writing Checker <support@example.com>
RESEND_INBOUND_WEBHOOK_SECRET=your_random_webhook_token

DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=verify-full

REVIEW_IMAGE_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
REVIEW_IMAGE_STORAGE_REGION=auto
REVIEW_IMAGE_STORAGE_BUCKET=ielts-writing-review-images
REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID=your_storage_access_key
REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY=your_storage_secret
```

For local development against a local Postgres instance, you can also set:

```env
POSTGRES_SSL=false
```

3. Run the application database migrations:

```bash
npm run db:migrate
```

4. Run the Better Auth migration:

```bash
npx auth@latest migrate --config ./lib/auth.ts --yes
```

5. Start the app:

```bash
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## Vercel + Neon + Spaceship + Cloudflare

This app is designed to run on Vercel with an external PostgreSQL database such as Neon.

Set these environment variables in Vercel:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `OPENAI_API_KEY`
- `QIANWEN_API_KEY`
- `QIANWEN_API_ENDPOINT` (recommended in production; use the workspace-specific endpoint for the API key's region)
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `SUPPORT_EMAIL_FROM`
- `RESEND_INBOUND_WEBHOOK_SECRET`
- `REVIEW_IMAGE_STORAGE_ENDPOINT`
- `REVIEW_IMAGE_STORAGE_REGION`
- `REVIEW_IMAGE_STORAGE_BUCKET`
- `REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID`
- `REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY`

Recommended production setup:

- Host the app on Vercel.
- Host Postgres on Neon.
- Use `BETTER_AUTH_URL=https://your-app.vercel.app`.
- Use a Neon connection string with `sslmode=verify-full`.
- Configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` so sign-up verification emails can be delivered.
- Configure `RESEND_INBOUND_WEBHOOK_SECRET` and point your Resend receiving webhook to:
  `https://your-domain.com/api/resend/inbound?token=YOUR_SECRET`
- Use `/admin/support` to review inbound support emails and send replies from the admin workspace.

## API

### `POST /api/check`

Runs a full review and consumes one unit of energy.
Send a stable `Idempotency-Key` header (16-128 letters, numbers, `_` or `-`) for each logical review attempt.
The same key can safely replay a completed response, but cannot be reused with a different payload.

Request body:

```json
{
  "taskType": "task1",
  "prompt": "IELTS prompt text",
  "essay": "Student response"
}
```

### `GET /api/energy`

Returns the current user session's energy balance and review cost.

### `GET /api/reviews`

Returns the current user's saved review history.

### `GET /api/reviews/:id`

Returns one saved review, including the original prompt, essay, and scored result.

### `GET /api/practice/questions`

Returns the signed-in user's Cambridge IELTS 5-21 practice question library index. The synced library contains 136 published Academic Writing questions:

- `source=cambridge_ielts`
- `module=academic`
- `book=5` through `book=21`
- `test=1` through `test=4`
- `taskType=task1` or `task2`
- `title` normalized to question codes such as `C8-T3-T2`
- `tags` populated from the source category labels
- `contentStatus=complete`
- `status=published`

Run the standalone seed script if you need to initialize the table outside a normal app request:

```bash
npm run db:seed:practice
```

The historical Task 2 library is stored separately in
`historical_practice_questions`. Import or update it from the source JSON with:

```bash
npm run db:import:historical -- /absolute/path/to/data.json
```

The import validates and normalizes the source, then upserts by question id, so
the command is safe to run again when the dataset changes.

To reconcile the historical library against Koolearn without using its topic
tags, run a dry comparison first:

```bash
npm run db:sync:historical:koolearn
```

The sync infers question type from the prompt and assigns topic categories by
similarity to the existing historical library. Review
`.data/koolearn-historical-sync-report.json`, then write only missing questions:

```bash
npm run db:sync:historical:koolearn -- --apply
```

Task 1 records use the existing seven chart categories inferred from the prompt.
Their source images are copied into the configured R2/S3-compatible project
storage, and only project object keys and image metadata are stored in Postgres.
Use `--task=task1` or `--task=task2` to reconcile one task independently.

You can also sync external metadata from Koolearn into the same records:

```bash
npm run db:sync:practice:koolearn
```

The Koolearn sync imports authorized question prompts into Postgres and copies Task 1 images to the configured R2/S3-compatible object storage. It writes the copied object key to `image_object_key` and keeps source URLs in metadata for traceability.

To sync a narrower slice, pass filters after `--`, for example `npm run db:sync:practice:koolearn -- --book=8` or `npm run db:sync:practice:koolearn -- --question=C8-T3-T2`.

Required for the sync:

- `DATABASE_URL`
- `REVIEW_IMAGE_STORAGE_ENDPOINT`
- `REVIEW_IMAGE_STORAGE_REGION`
- `REVIEW_IMAGE_STORAGE_BUCKET`
- `REVIEW_IMAGE_STORAGE_ACCESS_KEY_ID`
- `REVIEW_IMAGE_STORAGE_SECRET_ACCESS_KEY`

### `GET /api/practice/questions/:id`

Returns one practice question metadata record and its prompt/image fields when those fields have been populated from an authorized source.

### `GET /api/practice/questions/:id/image`

Streams a synced Task 1 image from R2/S3-compatible object storage through the app after the same authenticated media quota checks used by review images.

### `POST /api/review-images/upload-url`

Returns a short-lived signed upload URL for direct browser image uploads.

### `POST /api/recharge/orders`

Creates a recharge order and initializes a provider payment session.

### `POST /api/payments/webhook`

Accepts provider webhooks.

## Notes

- Review energy is tied to the signed-in Better Auth user.
- PostgreSQL is required for deployment. Local file-based SQLite is no longer used.
- Neon(DB), Vercel(Deploy) and Spaceship(Domain)
- The object storage bucket must allow browser `PUT` from your app origin with `Content-Type` in allowed headers.

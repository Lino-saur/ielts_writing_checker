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
- Uses `DeepSeek` for AI feedback.

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

DEEPSEEK_API_KEY=your_deepseek_key_here

BETTER_AUTH_SECRET=your_long_random_secret
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=your_resend_api_key
AUTH_EMAIL_FROM=IELTS Writing Checker <no-reply@example.com>
SUPPORT_EMAIL_FROM=IELTS Writing Checker <support@example.com>
RESEND_INBOUND_WEBHOOK_SECRET=your_random_webhook_token

DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require

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

3. Run the Better Auth migration:

```bash
npx auth@latest migrate --config ./lib/auth.ts --yes
```

4. Start the app:

```bash
npm run dev
```

5. Open:

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
- `DEEPSEEK_API_KEY`
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
- Use a Neon connection string with `sslmode=require`.
- Configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` so sign-up verification emails can be delivered.
- Configure `RESEND_INBOUND_WEBHOOK_SECRET` and point your Resend receiving webhook to:
  `https://your-domain.com/api/resend/inbound?token=YOUR_SECRET`
- Use `/admin/support` to review inbound support emails and send replies from the admin workspace.

## API

### `POST /api/check`

Runs a full review and consumes one unit of energy.

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

## TODO

* [ ] 真题练习模式
* [ ] Task1 功能
* [ ] 图片上传（OCR）

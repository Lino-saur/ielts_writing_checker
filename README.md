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
- Binds review energy to a Better Auth user session.
- Uses `DeepSeek` for AI feedback.
- Falls back to a local heuristic scorer when the AI call fails.

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

DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
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

## Vercel + Neon

This app is designed to run on Vercel with an external PostgreSQL database such as Neon.

Set these environment variables in Vercel:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`

Recommended production setup:

- Host the app on Vercel.
- Host Postgres on Neon.
- Use `BETTER_AUTH_URL=https://your-app.vercel.app`.
- Use a Neon connection string with `sslmode=require`.

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

## Notes

- The heuristic mode is intentionally simple. It keeps the app usable when AI output fails, but it is not a substitute for a real IELTS examiner.
- Review energy is tied to the Better Auth session user, including anonymous users.
- PostgreSQL is required for deployment. Local file-based SQLite is no longer used.
- Neon(DB), Vercel(Deploy) and Spaceship(Domain)

## TODO

* [ ] 真题练习模式
* [ ] Task1 功能
* [ ] 图片上传（OCR）

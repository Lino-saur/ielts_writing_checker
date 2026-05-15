# IELTS Writing Checker

AI-powered MVP IELTS writing checker for Task 1 and Task 2.

## What It Does

- Accepts an IELTS prompt and writing response.
- Supports both `Task 1` and `Task 2`.
- Returns an estimated overall band score.
- Breaks feedback into the four IELTS criteria:
  - Task Achievement
  - Coherence and Cohesion
  - Lexical Resource
  - Grammatical Range and Accuracy
- Highlights strengths, priority fixes, and a sample rewrite.
- Uses OpenAI when `OPENAI_API_KEY` is configured.
- Falls back to a local heuristic scorer when no API key is present or the API call fails.

## Stack

- Next.js 15
- React 19
- TypeScript

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Optional: add an OpenAI API key:

```bash
cp .env.example .env.local
```

Then set:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

3. Start the app:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## API

`POST /api/check`

Request body:

```json
{
  "taskType": "task1",
  "prompt": "IELTS prompt text",
  "essay": "Student response"
}
```

## Notes

- The heuristic mode is intentionally simple. It keeps the MVP usable without external dependencies, but it is not a substitute for a real IELTS examiner.
- The AI mode is intended to give more specific feedback while preserving the same response shape for the frontend.

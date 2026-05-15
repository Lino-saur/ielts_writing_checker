# IELTS Writing Checker

AI-powered IELTS writing checker for Task 1 and Task 2 with selectable model providers.

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
- Supports provider selection between `OpenAI`, `DeepSeek`, and `Auto`.
- Uses OpenAI when `OPENAI_API_KEY` is configured.
- Uses DeepSeek when `DEEPSEEK_API_KEY` is configured.
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

2. Optional: configure one or both AI providers:

```bash
cp .env.example .env.local
```

Then set:

```bash
AI_PROVIDER=auto

OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-5.4

DEEPSEEK_API_KEY=your_deepseek_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
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
- In `auto` mode, the backend tries the preferred provider first and falls back to the other configured provider before using heuristic mode.
- DeepSeek integration uses the official OpenAI-compatible chat completions endpoint with JSON output enabled.

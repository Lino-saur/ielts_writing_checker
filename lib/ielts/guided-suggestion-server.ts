import {
  buildGuidedSuggestionPrompt,
  parseGuidedSuggestionResponse,
  type GuidedSuggestionTarget,
  type GuidedWritingDraft
} from "./guided-writing";

type ChatCompletionPayload = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function generateGuidedWritingSuggestion(input: {
  taskPrompt: string;
  field: GuidedSuggestionTarget;
  draft: GuidedWritingDraft;
  locale: "en" | "zh-CN";
}) {
  const apiKey = process.env.QIANWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("QIANWEN_API_KEY is not configured.");

  const response = await fetch(
    process.env.QIANWEN_API_ENDPOINT?.trim() || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.QIANWEN_MODEL || "qwen3.7-plus",
        enable_thinking: false,
        temperature: 0.35,
        max_tokens: 140,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a restrained IELTS writing coach. Give only the requested micro-hint. Never produce a full paragraph or essay. Return JSON with exactly one key: suggestion."
          },
          { role: "user", content: buildGuidedSuggestionPrompt(input) }
        ]
      })
    }
  );
  if (!response.ok) throw new Error(`GUIDED_SUGGESTION_PROVIDER_${response.status}`);
  const payload = await response.json() as ChatCompletionPayload;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("GUIDED_SUGGESTION_EMPTY_RESPONSE");
  return parseGuidedSuggestionResponse(content);
}

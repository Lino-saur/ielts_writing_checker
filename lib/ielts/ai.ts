import { buildRevisionPrompt, buildScorePrompt, loadBasePrompt } from "./prompts";
import { normalizeRevisionResult, normalizeScoreResult, parseRevisionStructuredResponse, parseScoreStructuredResponse, previewText, cleanModelText } from "./parsing";
import {
  ChatCompletionsPayload,
  ChatMessage,
  CheckInput,
  ProviderConfig,
  WritingRevisionResult,
  WritingScoreResult,
  countWords
} from "./shared";

function getDeepSeekConfig(): ProviderConfig {
  return {
    name: "deepseek",
    apiKey: process.env.DEEPSEEK_API_KEY,
    endpoint: "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    extraBody: {
      thinking: {
        type: "disabled"
      },
      temperature: 0.3,
      max_tokens: 2200
    }
  };
}

async function runTaggedCompletion<T>(
  input: CheckInput,
  config: ProviderConfig,
  options: {
    kind: "score" | "revision";
    systemPrompt: string;
    prompt: string;
    parse: (text: string) => T;
    normalize: (parsed: T, input: CheckInput, providerName: ProviderConfig["name"]) => T;
  }
): Promise<T> {
  if (!config.apiKey) {
    throw new Error(`${config.name.toUpperCase()}_API_KEY is not configured.`);
  }

  const wordCount = countWords(input.essay);
  const baseMessages: ChatMessage[] = [
    {
      role: "system",
      content: options.systemPrompt
    },
    {
      role: "user",
      content: options.prompt
    }
  ];

  console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][REQUEST]`, {
    provider: config.name,
    model: config.model,
    taskType: input.taskType,
    locale: input.locale,
    wordCount,
    promptLength: options.prompt.length,
    essayLength: input.essay.length
  });

  async function requestCompletion(messages: ChatMessage[], phase: "first" | "retry" | "repair") {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        ...config.extraBody
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IELTS_CHECK][HTTP_ERROR]", {
        provider: config.name,
        phase,
        status: response.status,
        bodyPreview: previewText(errorText)
      });
      throw new Error(`${config.name} request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as ChatCompletionsPayload;
    const text = payload.choices?.[0]?.message?.content;

    if (!text) {
      console.error("[IELTS_CHECK][EMPTY_RESPONSE]", {
        provider: config.name,
        phase,
        payloadPreview: previewText(JSON.stringify(payload))
      });
      throw new Error(`${config.name} response was empty.`);
    }

    console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][RAW_RESPONSE]`, {
      provider: config.name,
      phase,
      rawLength: text.length,
      rawPreview: previewText(text),
      cleanedPreview: previewText(cleanModelText(text))
    });

    return text;
  }

  const firstText = await requestCompletion(baseMessages, "first");

  try {
    const parsed = options.parse(firstText);
    console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
      provider: config.name,
      phase: "first",
      preview: previewText(JSON.stringify(parsed))
    });
    return options.normalize(parsed, input, config.name);
  } catch (firstError) {
    console.error(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_FAIL]`, {
      provider: config.name,
      phase: "first",
      error: firstError instanceof Error ? firstError.message : String(firstError),
      rawPreview: previewText(firstText),
      cleanedPreview: previewText(cleanModelText(firstText))
    });

    const retryText = await requestCompletion(
      [
        ...baseMessages,
        {
          role: "assistant",
          content: firstText
        },
        {
          role: "user",
          content: `Your previous reply was invalid for this exact reason: ${
            firstError instanceof Error ? firstError.message : String(firstError)
          }. Return ONLY the required sections in the exact same order, with the exact same section headers, and no JSON or markdown fences.`
        }
      ],
      "retry"
    );

    try {
      const parsed = options.parse(retryText);
      console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
        provider: config.name,
        phase: "retry",
        preview: previewText(JSON.stringify(parsed))
      });
      return options.normalize(parsed, input, config.name);
    } catch (retryError) {
      console.error(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_FAIL]`, {
        provider: config.name,
        phase: "retry",
        error: retryError instanceof Error ? retryError.message : String(retryError),
        rawPreview: previewText(retryText),
        cleanedPreview: previewText(cleanModelText(retryText))
      });

      const repairText = await requestCompletion(
        [
          ...baseMessages,
          {
            role: "assistant",
            content: retryText
          },
          {
            role: "user",
            content: `Do not rescore. Do not rewrite the evaluation. Only repair your previous answer so it exactly matches the required tagged-section template. The concrete problem to fix is: ${
              retryError instanceof Error ? retryError.message : String(retryError)
            }. Keep the content semantically the same.`
          }
        ],
        "repair"
      );

      try {
        const parsed = options.parse(repairText);
        console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
          provider: config.name,
          phase: "repair",
          preview: previewText(JSON.stringify(parsed))
        });
        return options.normalize(parsed, input, config.name);
      } catch (repairError) {
        console.error(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_FAIL]`, {
          provider: config.name,
          phase: "repair",
          error: repairError instanceof Error ? repairError.message : String(repairError),
          rawPreview: previewText(repairText),
          cleanedPreview: previewText(cleanModelText(repairText))
        });
        throw repairError instanceof Error ? repairError : retryError instanceof Error ? retryError : firstError;
      }
    }
  }
}

export async function buildAiScoreFeedback(input: CheckInput): Promise<WritingScoreResult> {
  const minimumWords = input.taskType === "task1" ? 150 : 250;
  const systemPrompt = await loadBasePrompt();
  return runTaggedCompletion(input, getDeepSeekConfig(), {
    kind: "score",
    systemPrompt,
    prompt: await buildScorePrompt(input, minimumWords, "deepseek"),
    parse: parseScoreStructuredResponse,
    normalize: normalizeScoreResult
  });
}

export async function buildAiRevisionFeedback(input: CheckInput): Promise<WritingRevisionResult> {
  const minimumWords = input.taskType === "task1" ? 150 : 250;
  const systemPrompt = await loadBasePrompt();
  return runTaggedCompletion(input, getDeepSeekConfig(), {
    kind: "revision",
    systemPrompt,
    prompt: await buildRevisionPrompt(input, minimumWords),
    parse: parseRevisionStructuredResponse,
    normalize: normalizeRevisionResult
  });
}

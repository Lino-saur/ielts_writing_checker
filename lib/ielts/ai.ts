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

type VisionGenerateContentPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type VisionProvider = "qianwen" | "gemini";

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

function getQianwenConfig(): ProviderConfig {
  return {
    name: "qianwen",
    apiKey: process.env.QIANWEN_API_KEY || process.env.DASHSCOPE_API_KEY,
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: process.env.QIANWEN_MODEL || "qwen3.7-plus",
    extraBody: {
      temperature: 0.3,
      max_tokens: 2200
    }
  };
}

function getGeminiConfig(): ProviderConfig {
  return {
    name: "gemini",
    apiKey: process.env.GEMINI_API_KEY,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash"
  };
}

function shouldUseVisionModel(input: CheckInput) {
  return input.taskType === "task1" && Boolean(input.taskImage);
}

function getVisionProvider(): VisionProvider {
  // Keep the alternate provider available in code, but route production traffic to Qianwen by default.
  if (process.env.ENABLE_GEMINI_VISION === "true") {
    return "gemini";
  }
  return "qianwen";
}

function readVisionPartsText(payload: VisionGenerateContentPayload) {
  const parts = payload.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: String(error)
    };
  }

  const errorWithExtras = error as Error & {
    code?: string;
    errno?: number | string;
    syscall?: string;
    hostname?: string;
    cause?: unknown;
  };

  return {
    name: error.name,
    message: error.message,
    code: errorWithExtras.code,
    errno: errorWithExtras.errno,
    syscall: errorWithExtras.syscall,
    hostname: errorWithExtras.hostname,
    cause:
      errorWithExtras.cause instanceof Error
        ? {
            name: errorWithExtras.cause.name,
            message: errorWithExtras.cause.message
          }
        : errorWithExtras.cause,
    stack: error.stack
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
    let response: Response;

    try {
      response = await fetch(config.endpoint, {
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
    } catch (error) {
      console.error("[IELTS_CHECK][NETWORK_ERROR]", {
        provider: config.name,
        model: config.model,
        endpoint: config.endpoint,
        phase,
        ...serializeError(error)
      });
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IELTS_CHECK][HTTP_ERROR]", {
        provider: config.name,
        model: config.model,
        endpoint: config.endpoint,
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

async function runAlternateVisionCompletion<T>(
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
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!input.taskImage) {
    throw new Error("TASK1_IMAGE_REQUIRED");
  }

  const taskImage = input.taskImage;

  const wordCount = countWords(input.essay);
  const endpoint = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;
  const baseParts = [
    {
      inline_data: {
        mime_type: taskImage.mimeType,
        data: taskImage.dataUrl.replace(/^data:[^;]+;base64,/, "")
      }
    },
    {
      text: `${options.systemPrompt}\n\n${options.prompt}`
    }
  ];

  console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][REQUEST]`, {
    provider: config.name,
    model: config.model,
    taskType: input.taskType,
    locale: input.locale,
    wordCount,
    promptLength: options.prompt.length,
    essayLength: input.essay.length,
    imageName: input.taskImage.name,
    imageMimeType: taskImage.mimeType
  });

  async function requestCompletion(
    textInstructions: string[],
    phase: "first" | "retry" | "repair"
  ) {
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...baseParts,
                ...textInstructions.map((text) => ({
                  text
                }))
              ]
            }
          ]
        })
      });
    } catch (error) {
      console.error("[IELTS_CHECK][GEMINI_NETWORK_ERROR]", {
        provider: config.name,
        model: config.model,
        endpoint,
        phase,
        imageName: taskImage.name,
        imageMimeType: taskImage.mimeType,
        ...serializeError(error)
      });
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IELTS_CHECK][HTTP_ERROR]", {
        provider: config.name,
        model: config.model,
        endpoint,
        phase,
        status: response.status,
        bodyPreview: previewText(errorText)
      });
      throw new Error(`${config.name} request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as VisionGenerateContentPayload;
    const text = readVisionPartsText(payload);

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

  const firstText = await requestCompletion([], "first");

  try {
    const parsed = options.parse(firstText);
    console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
      provider: config.name,
      phase: "first",
      preview: previewText(JSON.stringify(parsed))
    });
    return options.normalize(parsed, input, config.name);
  } catch (firstError) {
    const retryText = await requestCompletion(
      [
        `Your previous reply was invalid for this exact reason: ${
          firstError instanceof Error ? firstError.message : String(firstError)
        }. Return ONLY the required sections in the exact same order, with the exact same section headers, and no JSON or markdown fences.`
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
      const repairText = await requestCompletion(
        [
          `Do not rescore. Do not rewrite the evaluation. Only repair your previous answer so it exactly matches the required tagged-section template. The concrete problem to fix is: ${
            retryError instanceof Error ? retryError.message : String(retryError)
          }. Keep the content semantically the same.`
        ],
        "repair"
      );

      const parsed = options.parse(repairText);
      console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
        provider: config.name,
        phase: "repair",
        preview: previewText(JSON.stringify(parsed))
      });
      return options.normalize(parsed, input, config.name);
    }
  }
}

async function runQianwenVisionCompletion<T>(
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
    throw new Error("QIANWEN_API_KEY is not configured.");
  }

  if (!input.taskImage) {
    throw new Error("TASK1_IMAGE_REQUIRED");
  }

  const taskImage = input.taskImage;
  const wordCount = countWords(input.essay);
  const baseMessages = [
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: taskImage.dataUrl
          }
        },
        {
          type: "text",
          text: `${options.systemPrompt}\n\n${options.prompt}`
        }
      ]
    }
  ];

  console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][REQUEST]`, {
    provider: config.name,
    model: config.model,
    taskType: input.taskType,
    locale: input.locale,
    wordCount,
    promptLength: options.prompt.length,
    essayLength: input.essay.length,
    imageName: taskImage.name,
    imageMimeType: taskImage.mimeType
  });

  async function requestCompletion(
    textInstructions: string[],
    phase: "first" | "retry" | "repair"
  ) {
    let response: Response;

    try {
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "user",
              content: [
                ...baseMessages[0].content,
                ...textInstructions.map((text) => ({
                  type: "text",
                  text
                }))
              ]
            }
          ],
          ...config.extraBody
        })
      });
    } catch (error) {
      console.error("[IELTS_CHECK][QIANWEN_NETWORK_ERROR]", {
        provider: config.name,
        model: config.model,
        endpoint: config.endpoint,
        phase,
        imageName: taskImage.name,
        imageMimeType: taskImage.mimeType,
        ...serializeError(error)
      });
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IELTS_CHECK][HTTP_ERROR]", {
        provider: config.name,
        model: config.model,
        endpoint: config.endpoint,
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

  const firstText = await requestCompletion([], "first");

  try {
    const parsed = options.parse(firstText);
    console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
      provider: config.name,
      phase: "first",
      preview: previewText(JSON.stringify(parsed))
    });
    return options.normalize(parsed, input, config.name);
  } catch (firstError) {
    const retryText = await requestCompletion(
      [
        `Your previous reply was invalid for this exact reason: ${
          firstError instanceof Error ? firstError.message : String(firstError)
        }. Return ONLY the required sections in the exact same order, with the exact same section headers, and no JSON or markdown fences.`
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
      const repairText = await requestCompletion(
        [
          `Do not rescore. Do not rewrite the evaluation. Only repair your previous answer so it exactly matches the required tagged-section template. The concrete problem to fix is: ${
            retryError instanceof Error ? retryError.message : String(retryError)
          }. Keep the content semantically the same.`
        ],
        "repair"
      );

      const parsed = options.parse(repairText);
      console.log(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
        provider: config.name,
        phase: "repair",
        preview: previewText(JSON.stringify(parsed))
      });
      return options.normalize(parsed, input, config.name);
    }
  }
}

export async function buildAiScoreFeedback(input: CheckInput): Promise<WritingScoreResult> {
  const minimumWords = input.taskType === "task1" ? 150 : 250;
  const systemPrompt = await loadBasePrompt();
  const visionProvider = getVisionProvider();
  const prompt = await buildScorePrompt(input, minimumWords, shouldUseVisionModel(input) ? visionProvider : "deepseek");

  if (shouldUseVisionModel(input)) {
    if (visionProvider === "gemini") {
      return runAlternateVisionCompletion(input, getGeminiConfig(), {
        kind: "score",
        systemPrompt,
        prompt,
        parse: parseScoreStructuredResponse,
        normalize: normalizeScoreResult
      });
    }

    return runQianwenVisionCompletion(input, getQianwenConfig(), {
      kind: "score",
      systemPrompt,
      prompt,
      parse: parseScoreStructuredResponse,
      normalize: normalizeScoreResult
    });
  }

  return runTaggedCompletion(input, getDeepSeekConfig(), {
    kind: "score",
    systemPrompt,
    prompt,
    parse: parseScoreStructuredResponse,
    normalize: normalizeScoreResult
  });
}

export async function buildAiRevisionFeedback(input: CheckInput): Promise<WritingRevisionResult> {
  const minimumWords = input.taskType === "task1" ? 150 : 250;
  const systemPrompt = await loadBasePrompt();
  const prompt = await buildRevisionPrompt(input, minimumWords);
  const visionProvider = getVisionProvider();

  if (shouldUseVisionModel(input)) {
    if (visionProvider === "gemini") {
      return runAlternateVisionCompletion(input, getGeminiConfig(), {
        kind: "revision",
        systemPrompt,
        prompt,
        parse: parseRevisionStructuredResponse,
        normalize: normalizeRevisionResult
      });
    }

    return runQianwenVisionCompletion(input, getQianwenConfig(), {
      kind: "revision",
      systemPrompt,
      prompt,
      parse: parseRevisionStructuredResponse,
      normalize: normalizeRevisionResult
    });
  }

  return runTaggedCompletion(input, getDeepSeekConfig(), {
    kind: "revision",
    systemPrompt,
    prompt,
    parse: parseRevisionStructuredResponse,
    normalize: normalizeRevisionResult
  });
}

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

function getAiRequestTimeoutMs(kind: "text" | "vision") {
  const variableName = kind === "vision" ? "AI_VISION_REQUEST_TIMEOUT_MS" : "AI_REQUEST_TIMEOUT_MS";
  const configured = Number(process.env[variableName]);
  const defaultTimeout = kind === "vision" ? 120_000 : 45_000;
  const maxTimeout = kind === "vision" ? 180_000 : 60_000;
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 5_000), maxTimeout) : defaultTimeout;
}

function logAiDebug(event: string, details: Record<string, unknown>) {
  if (process.env.AI_DEBUG_LOGS === "true") {
    console.log(event, details);
  }
}

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
      enable_thinking: false,
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

function materializeAnnotatedEssay(annotatedEssay: string) {
  return annotatedEssay
    .replace(/\[del#([A-Za-z0-9_-]+)\][\s\S]*?\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g, "$2")
    .replace(/\[del\][\s\S]*?\[\/del\]\[add\]([\s\S]*?)\[\/add\]/g, "$1");
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
        signal: AbortSignal.timeout(getAiRequestTimeoutMs("text")),
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
        status: response.status
      });
      logAiDebug("[IELTS_CHECK][HTTP_ERROR_BODY]", {
        provider: config.name,
        phase,
        bodyPreview: previewText(errorText)
      });
      throw new Error(`${config.name.toUpperCase()}_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as ChatCompletionsPayload;
    const text = payload.choices?.[0]?.message?.content;

    if (!text) {
      console.error("[IELTS_CHECK][EMPTY_RESPONSE]", { provider: config.name, phase });
      logAiDebug("[IELTS_CHECK][EMPTY_RESPONSE_PAYLOAD]", {
        provider: config.name,
        phase,
        payloadPreview: previewText(JSON.stringify(payload))
      });
      throw new Error(`${config.name} response was empty.`);
    }

    logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][RAW_RESPONSE]`, {
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
    logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
      provider: config.name,
      phase: "first",
      preview: previewText(JSON.stringify(parsed))
    });
    return options.normalize(parsed, input, config.name);
  } catch (firstError) {
    console.error(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_FAIL]`, {
      provider: config.name,
      phase: "first",
      errorType: firstError instanceof Error ? firstError.name : typeof firstError
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
      logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
        provider: config.name,
        phase: "retry",
        preview: previewText(JSON.stringify(parsed))
      });
      return options.normalize(parsed, input, config.name);
    } catch (retryError) {
      console.error(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_FAIL]`, {
        provider: config.name,
        phase: "retry",
        errorType: retryError instanceof Error ? retryError.name : typeof retryError
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
        logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
          provider: config.name,
          phase: "repair",
          preview: previewText(JSON.stringify(parsed))
        });
        return options.normalize(parsed, input, config.name);
      } catch (repairError) {
        console.error(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_FAIL]`, {
          provider: config.name,
          phase: "repair",
          errorType: repairError instanceof Error ? repairError.name : typeof repairError
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
        signal: AbortSignal.timeout(getAiRequestTimeoutMs("vision")),
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
        endpoint: config.endpoint,
        phase,
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
        status: response.status
      });
      logAiDebug("[IELTS_CHECK][HTTP_ERROR_BODY]", {
        provider: config.name,
        phase,
        bodyPreview: previewText(errorText)
      });
      throw new Error(`${config.name.toUpperCase()}_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as VisionGenerateContentPayload;
    const text = readVisionPartsText(payload);

    if (!text) {
      console.error("[IELTS_CHECK][EMPTY_RESPONSE]", { provider: config.name, phase });
      logAiDebug("[IELTS_CHECK][EMPTY_RESPONSE_PAYLOAD]", {
        provider: config.name,
        phase,
        payloadPreview: previewText(JSON.stringify(payload))
      });
      throw new Error(`${config.name} response was empty.`);
    }

    logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][RAW_RESPONSE]`, {
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
    logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
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
      logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
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
      logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
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
            url: taskImage.dataUrl,
            max_pixels: 4_194_304
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
        signal: AbortSignal.timeout(getAiRequestTimeoutMs("vision")),
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
        status: response.status
      });
      logAiDebug("[IELTS_CHECK][HTTP_ERROR_BODY]", {
        provider: config.name,
        phase,
        bodyPreview: previewText(errorText)
      });
      throw new Error(`${config.name.toUpperCase()}_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as ChatCompletionsPayload;
    const text = payload.choices?.[0]?.message?.content;

    if (!text) {
      console.error("[IELTS_CHECK][EMPTY_RESPONSE]", { provider: config.name, phase });
      logAiDebug("[IELTS_CHECK][EMPTY_RESPONSE_PAYLOAD]", {
        provider: config.name,
        phase,
        payloadPreview: previewText(JSON.stringify(payload))
      });
      throw new Error(`${config.name} response was empty.`);
    }

    logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][RAW_RESPONSE]`, {
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
    logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
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
      logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
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
      logAiDebug(`[IELTS_CHECK][${options.kind.toUpperCase()}][PARSE_SUCCESS]`, {
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
  const prompt = await buildScorePrompt(input, minimumWords);

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
  const visionProvider = getVisionProvider();
  const grammarPrompt = await buildRevisionPrompt(input, minimumWords, "grammar");

  async function runRevisionPass(revisionInput: CheckInput, prompt: string) {
    if (shouldUseVisionModel(revisionInput)) {
      if (visionProvider === "gemini") {
        return runAlternateVisionCompletion(revisionInput, getGeminiConfig(), {
          kind: "revision",
          systemPrompt,
          prompt,
          parse: parseRevisionStructuredResponse,
          normalize: normalizeRevisionResult
        });
      }

      return runQianwenVisionCompletion(revisionInput, getQianwenConfig(), {
        kind: "revision",
        systemPrompt,
        prompt,
        parse: parseRevisionStructuredResponse,
        normalize: normalizeRevisionResult
      });
    }

    return runTaggedCompletion(revisionInput, getDeepSeekConfig(), {
      kind: "revision",
      systemPrompt,
      prompt,
      parse: parseRevisionStructuredResponse,
      normalize: normalizeRevisionResult
    });
  }

  const grammarRevision = await runRevisionPass(input, grammarPrompt);
  const grammarCleanEssay = materializeAnnotatedEssay(grammarRevision.annotatedEssay);
  const optimizationInput: CheckInput = {
    ...input,
    essay: grammarCleanEssay
  };
  const optimizationPrompt = await buildRevisionPrompt(optimizationInput, minimumWords, "optimization");
  const optimizationRevision = await runRevisionPass(optimizationInput, optimizationPrompt);

  return {
    ...optimizationRevision,
    annotatedEssay: optimizationRevision.annotatedEssay,
    correctionNotes: optimizationRevision.correctionNotes,
    grammarRevision: {
      annotatedEssay: grammarRevision.annotatedEssay,
      correctionNotes: grammarRevision.correctionNotes
    },
    optimizationRevision: {
      annotatedEssay: optimizationRevision.annotatedEssay,
      correctionNotes: optimizationRevision.correctionNotes
    }
  };
}

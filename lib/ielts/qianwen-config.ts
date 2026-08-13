const DEFAULT_QIANWEN_API_ENDPOINT =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export function getQianwenApiEndpoint() {
  return (
    process.env.QIANWEN_API_ENDPOINT_GLOBAL?.trim() ||
    process.env.QIANWEN_API_ENDPOINT?.trim() ||
    DEFAULT_QIANWEN_API_ENDPOINT
  );
}

export function isGlobalQianwenEndpoint(endpoint: string) {
  try {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    return hostname === "dashscope-intl.aliyuncs.com" || hostname.includes(".ap-southeast-1.maas.aliyuncs.com");
  } catch {
    return false;
  }
}

export function getQianwenApiCredentials(endpoint = getQianwenApiEndpoint()) {
  const configuredGlobalEndpoint = process.env.QIANWEN_API_ENDPOINT_GLOBAL?.trim();
  const usesGlobalKey = configuredGlobalEndpoint === endpoint || isGlobalQianwenEndpoint(endpoint);
  return {
    apiKey: usesGlobalKey
      ? process.env.QIANWEN_API_KEY_GLOBAL
      : process.env.QIANWEN_API_KEY || process.env.DASHSCOPE_API_KEY,
    apiKeyEnvironmentVariable: usesGlobalKey ? "QIANWEN_API_KEY_GLOBAL" : "QIANWEN_API_KEY",
    endpoint
  };
}

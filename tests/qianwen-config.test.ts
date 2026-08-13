import { afterEach, describe, expect, it, vi } from "vitest";
import { getQianwenApiCredentials, isGlobalQianwenEndpoint } from "@/lib/ielts/qianwen-config";

afterEach(() => vi.unstubAllEnvs());

describe("Qianwen regional credentials", () => {
  it("uses the mainland key for the Beijing endpoint", () => {
    vi.stubEnv("QIANWEN_API_KEY", "mainland-key");
    vi.stubEnv("QIANWEN_API_KEY_GLOBAL", "global-key");
    vi.stubEnv("QIANWEN_API_ENDPOINT", "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions");

    expect(getQianwenApiCredentials()).toMatchObject({
      apiKey: "mainland-key",
      apiKeyEnvironmentVariable: "QIANWEN_API_KEY"
    });
  });

  it("uses only the global key for a Singapore workspace endpoint", () => {
    vi.stubEnv("QIANWEN_API_KEY", "mainland-key");
    vi.stubEnv("QIANWEN_API_KEY_GLOBAL", "global-key");
    vi.stubEnv("QIANWEN_API_ENDPOINT", "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions");

    expect(getQianwenApiCredentials()).toMatchObject({
      apiKey: "global-key",
      apiKeyEnvironmentVariable: "QIANWEN_API_KEY_GLOBAL"
    });
  });

  it("prefers the global endpoint and key when both regional pairs are configured", () => {
    vi.stubEnv("QIANWEN_API_KEY", "mainland-key");
    vi.stubEnv("QIANWEN_API_KEY_GLOBAL", "global-key");
    vi.stubEnv("QIANWEN_API_ENDPOINT", "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions");
    vi.stubEnv("QIANWEN_API_ENDPOINT_GLOBAL", "https://global.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions");

    expect(getQianwenApiCredentials()).toEqual({
      apiKey: "global-key",
      apiKeyEnvironmentVariable: "QIANWEN_API_KEY_GLOBAL",
      endpoint: "https://global.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions"
    });
  });

  it("does not fall back to the mainland key for the shared international endpoint", () => {
    vi.stubEnv("QIANWEN_API_KEY", "mainland-key");
    vi.stubEnv("QIANWEN_API_KEY_GLOBAL", "");
    vi.stubEnv("QIANWEN_API_ENDPOINT", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");

    expect(isGlobalQianwenEndpoint(process.env.QIANWEN_API_ENDPOINT!)).toBe(true);
    expect(getQianwenApiCredentials().apiKey).toBe("");
  });
});

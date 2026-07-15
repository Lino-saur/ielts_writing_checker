export function cleanModelText(text: string) {
  return text
    .replace(/```json/gi, "```")
    .replace(/```text/gi, "```")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```/g, "")
    .trim();
}

export function previewText(text: string, maxLength = 400) {
  return text.slice(0, maxLength).replace(/\s+/g, " ");
}

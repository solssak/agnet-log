import type { Message, CodeSnippet } from "../types";

export const getMessageText = (message: Message): string => {
  const content = message.message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text);
    return texts.join("\n");
  }
  return "";
};

export const extractCodeSnippets = (messages: Message[]): CodeSnippet[] => {
  const snippets: CodeSnippet[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  for (const msg of messages) {
    const text = getMessageText(msg);
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      snippets.push({
        language: match[1] || "text",
        code: match[2].trim(),
        role: msg.message?.role || "",
        timestamp: msg.timestamp || "",
      });
    }
  }
  return snippets;
};

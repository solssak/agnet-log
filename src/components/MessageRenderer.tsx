import hljs from "highlight.js";
import { CodeBlock } from "./CodeBlock";

type Props = {
  content: string;
};

type Block =
  | { type: "text"; content: string }
  | { type: "code"; language: string; content: string };

function looksLikeCode(text: string): boolean {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return false;

  const codeIndicators = [
    /^(import|export|const|let|var|function|class|interface|type|def|from|return)\s/m,
    /[{};]\s*$/m,
    /^\s{2,}(if|for|while|return|const|let|var)\s/m,
    /=>\s*[{(]/,
    /<\/?[A-Z][a-zA-Z]*[\s/>]/,
    /\(\s*\)\s*[{=]/,
  ];

  const matchCount = codeIndicators.filter((pattern) =>
    pattern.test(text),
  ).length;

  return matchCount >= 2;
}

function detectLanguage(code: string): string | null {
  try {
    const result = hljs.highlightAuto(code, [
      "javascript",
      "typescript",
      "python",
      "rust",
      "go",
      "java",
      "c",
      "cpp",
      "css",
      "html",
      "json",
      "bash",
      "sql",
    ]);
    if (result.relevance > 5) {
      return result.language || null;
    }
  } catch {
    return null;
  }
  return null;
}

function parseContent(text: string): Block[] {
  const blocks: Block[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index);
      blocks.push(...parseTextForCode(textContent));
    }

    blocks.push({
      type: "code",
      language: match[1] || "text",
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    blocks.push(...parseTextForCode(textContent));
  }

  return blocks;
}

function parseTextForCode(text: string): Block[] {
  const blocks: Block[] = [];
  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (looksLikeCode(trimmed)) {
      const detectedLang = detectLanguage(trimmed);
      if (detectedLang) {
        blocks.push({
          type: "code",
          language: detectedLang + " (auto)",
          content: trimmed,
        });
        continue;
      }
    }

    blocks.push({
      type: "text",
      content: para,
    });
  }

  return blocks;
}

export function MessageRenderer({ content }: Props) {
  const blocks = parseContent(content);

  if (blocks.length === 0) {
    return <div className="text-block">{content}</div>;
  }

  return (
    <div className="message-blocks">
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          const isAuto = block.language.includes("(auto)");
          const lang = block.language.replace(" (auto)", "");
          return (
            <div key={idx} className="code-block-wrapper">
              <div className="code-block-header">
                <span className="code-language">{lang}</span>
                {isAuto && <span className="auto-detected">auto-detected</span>}
              </div>
              <CodeBlock code={block.content} language={lang} />
            </div>
          );
        }
        return (
          <div key={idx} className="text-block">
            {block.content}
          </div>
        );
      })}
    </div>
  );
}

import type { CodeSnippet } from "../types";

type Props = {
  snippets: CodeSnippet[];
  onCopy: (code: string) => void;
};

export const CodeSnippetsView = ({ snippets, onCopy }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      {snippets.map((snippet, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800">
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded">
              {snippet.language}
            </span>
            <span
              className={`text-xs font-semibold  px-2 py-0.5 rounded ${
                snippet.role === "user"
                  ? "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300"
                  : "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200"
              }`}
            >
              {snippet.role}
            </span>
            <button
              className="ml-auto px-2.5 py-1 text-xs font-medium bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-600"
              onClick={() => onCopy(snippet.code)}
            >
              Copy
            </button>
          </div>
          <pre className="p-3 bg-zinc-50 dark:bg-zinc-950 text-sm leading-relaxed overflow-x-auto font-mono">
            {snippet.code}
          </pre>
        </div>
      ))}
    </div>
  );
};

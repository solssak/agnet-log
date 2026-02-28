import { useMemo } from "react";
import type { Message, SessionContext, ViewMode } from "../types";
import { extractCodeSnippets } from "../utils/message";
import { MessageList } from "./message-list";
import { CodeSnippetsView } from "./code-snippets-view";
import { SessionContextView } from "./session-context-view";
import { cn } from "../utils/cn";

type Props = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  messages: Message[];
  sessionContext: SessionContext | null;
  onCopy: (text: string) => void;
  onLoadContext: () => void;
};

export const ContentViewer = ({
  viewMode,
  setViewMode,
  messages,
  sessionContext,
  onCopy,
  onLoadContext,
}: Props) => {
  const codeSnippets = useMemo(() => extractCodeSnippets(messages), [messages]);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-mono font-semibold">
          {viewMode === "messages" && `messages(${messages.length})`}
          {viewMode === "snippets" && `code snippets (${codeSnippets.length})`}
          {viewMode === "context" && "session context"}
        </h2>
        <div className="flex gap-1">
          {(["messages", "snippets", "context"] as const).map((mode) => (
            <button
              key={mode}
              className={cn(
                "px-3 py-1.5 text-xs font-mono font-medium rounded-lg border",
                viewMode === mode
                  ? "bg-teal-500 border-teal-500 text-white hover:bg-teal-600"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              )}
              onClick={() => {
                setViewMode(mode);
                if (mode === "context" && !sessionContext) onLoadContext();
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "messages" && <MessageList messages={messages} />}

      {viewMode === "snippets" && (
        <CodeSnippetsView snippets={codeSnippets} onCopy={onCopy} />
      )}

      {viewMode === "context" && sessionContext && (
        <SessionContextView sessionContext={sessionContext} />
      )}

      {viewMode === "context" && !sessionContext && (
        <div className="flex justify-center items-center py-8 text-zinc-500">
          Loading context...
        </div>
      )}
    </>
  );
};

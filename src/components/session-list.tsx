import type { Session } from "../types";
import { formatDate, formatTokens } from "../utils/format";
import { cn } from "../utils/cn";

type Props = {
  sessions: Session[];
  selectedSession: Session | null;
  onSessionClick: (session: Session) => void;
};

export const SessionList = ({
  sessions,
  selectedSession,
  onSessionClick,
}: Props) => {
  return (
    <>
      <h2 className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 font-mono">
        Sessions
      </h2>
      <div className="max-h-[40vh] overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "px-4 py-3 cursor-pointer border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800",
              selectedSession?.id === session.id && "bg-white dark:bg-zinc-800"
            )}
            onClick={() => onSessionClick(session)}
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {formatDate(session.modified)}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ↓{formatTokens(session.input_tokens)} ↑
                {formatTokens(session.output_tokens)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

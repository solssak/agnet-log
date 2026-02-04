import type { SessionContext } from "../types";

type Props = {
  sessionContext: SessionContext;
};

export const SessionContextView = ({ sessionContext }: Props) => {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
          Modified files ({sessionContext.file_changes.length})
        </h3>
        <div className="flex flex-col gap-2">
          {sessionContext.file_changes.length === 0 ? (
            <p className="text-sm text-zinc-400 italic">
              No file modifications found.
            </p>
          ) : (
            [
              ...new Map(
                sessionContext.file_changes.map((f) => [f.file_path, f]),
              ).values(),
            ].map((change, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                <span
                  className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                    change.action.toLowerCase().includes("edit")
                      ? "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200"
                      : "bg-zinc-500 text-white dark:bg-zinc-500 dark:text-zinc-100"
                  }`}
                >
                  {change.action}
                </span>
                <span className="text-xs font-mono break-all">
                  {change.file_path}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
          Git commits ({sessionContext.git_commits.length})
        </h3>
        <div className="flex flex-col gap-3">
          {sessionContext.git_commits.length === 0 ? (
            <p className="text-sm text-zinc-400 italic">
              No commits found in this time range.
            </p>
          ) : (
            sessionContext.git_commits.map((commit, idx) => (
              <div
                key={idx}
                className="p-3 bg-white dark:bg-zinc-800 rounded-lg border-l-3 border-zinc-500"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                    {commit.hash.slice(0, 7)}
                  </span>
                  <span className="text-sm font-medium">{commit.message}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {commit.files.map((file, fidx) => (
                    <span
                      key={fidx}
                      className="text-xs font-mono bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

import type { SearchResult } from "../types";
import { cn } from "../utils/cn";

type Props = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onResultClick: (result: SearchResult) => void;
};

export const SearchBar = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  onSubmit,
  onResultClick,
}: Props) => {
  return (
    <>
      <form
        className="p-3 border-b border-zinc-300 dark:border-zinc-700"
        onSubmit={onSubmit}
      >
        <input
          type="text"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          placeholder="Search messages"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      {searchResults.length > 0 && (
        <>
          <h2 className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            Search results ({searchResults.length})
          </h2>
          <div className="max-h-72 overflow-y-auto">
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                className="px-4 py-3 cursor-pointer border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800"
                onClick={() => onResultClick(result)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      result.role === "user"
                        ? "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300"
                        : "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200"
                    )}
                  >
                    {result.role}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {result.project_name.split("/").pop()}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {result.content_preview}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isSearching && (
        <div className="flex justify-center items-center py-8 text-zinc-500">
          Searching...
        </div>
      )}
    </>
  );
};

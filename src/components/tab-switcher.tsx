import type { SidebarTab } from "../types";
import { cn } from "../utils/cn";

type Props = {
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  isAtTop: boolean;
};

export const TabSwitcher = ({ sidebarTab, setSidebarTab, isAtTop }: Props) => {
  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-zinc-200/50 dark:border-white/10 shadow-lg transition-all duration-300",
        isAtTop
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-20 pointer-events-none"
      )}
    >
      <button
        className={cn(
          "px-5 py-2.5 rounded-xl text-xs font-mono font-semibold tracking-wide transition-all",
          sidebarTab === "profile"
            ? "bg-teal-500 text-white hover:bg-teal-600"
            : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
        )}
        onClick={() => setSidebarTab("profile")}
      >
        Profile
      </button>
      <button
        className={cn(
          "px-5 py-2.5 rounded-xl text-xs font-mono font-semibold tracking-wide transition-all",
          sidebarTab === "browse"
            ? "bg-teal-500 text-white hover:bg-teal-600"
            : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
        )}
        onClick={() => setSidebarTab("browse")}
      >
        Browse
      </button>
    </div>
  );
};

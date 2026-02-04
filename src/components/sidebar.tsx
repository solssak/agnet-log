import type { Project, Session, SearchResult } from "../types";
import { SearchBar } from "./search-bar";
import { ProjectList } from "./project-list";
import { SessionList } from "./session-list";

type Props = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  onSearch: (e: React.FormEvent) => void;
  onSearchResultClick: (result: SearchResult) => void;
  projects: Project[];
  selectedProject: Project | null;
  onProjectClick: (project: Project) => void;
  sessions: Session[];
  selectedSession: Session | null;
  onSessionClick: (session: Session) => void;
};

export const Sidebar = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  onSearch,
  onSearchResultClick,
  projects,
  selectedProject,
  onProjectClick,
  sessions,
  selectedSession,
  onSessionClick,
}: Props) => {
  return (
    <div className="w-80 flex flex-col overflow-hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-xl">
      <div className="flex-1 overflow-y-auto">
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onSubmit={onSearch}
          onResultClick={onSearchResultClick}
        />

        <ProjectList
          projects={projects}
          selectedProject={selectedProject}
          onProjectClick={onProjectClick}
        />

        {selectedProject && (
          <SessionList
            sessions={sessions}
            selectedSession={selectedSession}
            onSessionClick={onSessionClick}
          />
        )}
      </div>
    </div>
  );
};

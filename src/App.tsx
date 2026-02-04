import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { useScrollPosition } from "./hooks/useScrollPosition";
import { TabSwitcher } from "./components/tab-switcher";
import { BackgroundGradient } from "./components/background-gradient";
import { Sidebar } from "./components/sidebar";
import { ContentViewer } from "./components/content-viewer";
import { CopyFeedback } from "./components/copy-feedback";
import { cn } from "./utils/cn";
import type {
  Project,
  Session,
  Message,
  SearchResult,
  SessionContext,
  ViewMode,
  SidebarTab,
} from "./types";

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("messages");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(
    null,
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("browse");

  const profileScrollRef = useRef<HTMLDivElement>(null);
  const browseScrollRef = useRef<HTMLDivElement>(null);

  const activeScrollRef =
    sidebarTab === "profile" ? profileScrollRef : browseScrollRef;
  const { isAtTop } = useScrollPosition(activeScrollRef);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const result = await invoke<Project[]>("get_projects");
      setProjects(result);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  }

  async function loadSessions(project: Project) {
    setLoading(true);
    setSelectedProject(project);
    setSelectedSession(null);
    setMessages([]);
    try {
      const result = await invoke<Session[]>("get_sessions", {
        projectPath: project.path,
      });
      setSessions(result);
      if (result.length > 0) {
        loadMessages(result[0]);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
    setLoading(false);
  }

  async function loadMessages(session: Session) {
    setLoading(true);
    setSelectedSession(session);
    setSessionContext(null);
    try {
      const result = await invoke<Message[]>("get_messages", {
        sessionPath: session.path,
      });
      setMessages(result);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
    setLoading(false);
  }

  async function loadContext() {
    if (!selectedSession || !selectedProject) return;
    try {
      const result = await invoke<SessionContext>("get_session_context", {
        sessionPath: selectedSession.path,
        projectName: selectedProject.name,
      });
      setSessionContext(result);
    } catch (error) {
      console.error("Failed to load context:", error);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await invoke<SearchResult[]>("search_messages", {
        query: searchQuery,
      });
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
    }
    setIsSearching(false);
  }

  async function openSearchResult(result: SearchResult) {
    setSearchResults([]);
    setSearchQuery("");

    const project = projects.find((p) => p.path === result.project_path);
    if (project) {
      setSelectedProject(project);
      const sessionsResult = await invoke<Session[]>("get_sessions", {
        projectPath: project.path,
      });
      setSessions(sessionsResult);

      const session = sessionsResult.find((s) => s.id === result.session_id);
      if (session) {
        setSelectedSession(session);
        const messagesResult = await invoke<Message[]>("get_messages", {
          sessionPath: session.path,
        });
        setMessages(messagesResult);
      }
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  return (
    <main
      className={cn(
        "flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        sidebarTab === "profile" && "block"
      )}
    >
      <TabSwitcher
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        isAtTop={isAtTop}
      />

      {sidebarTab === "profile" && (
        <>
          <BackgroundGradient />
          <div
            ref={profileScrollRef}
            className="w-screen p-4 overflow-y-auto h-screen relative z-10"
          >
            <div className="max-w-4xl mx-auto p-6">
              <Dashboard />
            </div>
          </div>
        </>
      )}

      {sidebarTab === "browse" && (
        <>
          <BackgroundGradient />
          <div className="flex gap-4 p-4 h-screen w-screen z-10">
            <Sidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearch={handleSearch}
              onSearchResultClick={openSearchResult}
              projects={projects}
              selectedProject={selectedProject}
              onProjectClick={loadSessions}
              sessions={sessions}
              selectedSession={selectedSession}
              onSessionClick={loadMessages}
            />

            <div
              ref={browseScrollRef}
              className="flex-1 w-full overflow-y-auto p-4"
            >
              {loading && (
                <div className="flex justify-center items-center h-full text-zinc-500">
                  Loading...
                </div>
              )}

              {!loading && selectedSession && (
                <ContentViewer
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  messages={messages}
                  sessionContext={sessionContext}
                  onCopy={copyToClipboard}
                  onLoadContext={loadContext}
                />
              )}

              {!loading && !selectedSession && (
                <div className="flex justify-center items-center h-full text-zinc-400 text-base">
                  Select a project and session to view messages.
                </div>
              )}

              <CopyFeedback message={copyFeedback} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export default App;

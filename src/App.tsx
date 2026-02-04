import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MessageRenderer } from "./components/MessageRenderer";
import { Dashboard } from "./components/Dashboard";
import { useScrollPosition } from "./hooks/useScrollPosition";

type Project = {
  name: string;
  path: string;
  session_count: number;
};

type Session = {
  id: string;
  path: string;
  size: number;
  modified: number;
  input_tokens: number;
  output_tokens: number;
};

type MessageContent = {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
};

type Message = {
  msg_type?: string;
  uuid?: string;
  parent_uuid?: string;
  timestamp?: string;
  session_id?: string;
  message?: MessageContent;
};

type SearchResult = {
  project_name: string;
  project_path: string;
  session_id: string;
  session_path: string;
  message_uuid: string;
  role: string;
  content_preview: string;
  timestamp: string;
};

type FileChange = {
  file_path: string;
  action: string;
  timestamp: string;
};

type GitCommit = {
  hash: string;
  message: string;
  timestamp: string;
  files: string[];
};

type SessionContext = {
  file_changes: FileChange[];
  git_commits: GitCommit[];
  project_path: string;
};

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
  const [viewMode, setViewMode] = useState<"messages" | "snippets" | "context">(
    "messages",
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(
    null,
  );
  const [sidebarTab, setSidebarTab] = useState<"profile" | "browse">("browse");
  
  const profileScrollRef = useRef<HTMLDivElement>(null);
  const browseScrollRef = useRef<HTMLDivElement>(null);
  
  const activeScrollRef = sidebarTab === "profile" ? profileScrollRef : browseScrollRef;
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

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTokens(tokens: number): string {
    if (tokens < 1000) return `${tokens}`;
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(2)}M`;
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

  function getMessageText(message: Message): string {
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
  }

  type CodeSnippet = {
    language: string;
    code: string;
    role: string;
    timestamp: string;
  };

  function extractCodeSnippets(): CodeSnippet[] {
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
    <main className={`flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 ${sidebarTab === "profile" ? "block" : ""}`}>
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-zinc-200/50 dark:border-white/10 shadow-lg transition-all duration-300 ${
          isAtTop ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-20 pointer-events-none"
        }`}>
        <button
          className={`px-5 py-2.5 rounded-xl text-xs font-mono font-semibold tracking-wide transition-all ${
            sidebarTab === "profile"
              ? "bg-teal-500 text-white hover:bg-teal-600"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
          }`}
          onClick={() => setSidebarTab("profile")}
        >
          Profile
        </button>
        <button
          className={`px-5 py-2.5 rounded-xl text-xs font-mono font-semibold tracking-wide transition-all ${
            sidebarTab === "browse"
              ? "bg-teal-500 text-white hover:bg-teal-600"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={() => setSidebarTab("browse")}
        >
          Browse
        </button>
      </div>

      {sidebarTab === "profile" && (
        <>
          <div className="fixed inset-0 pointer-events-none z-0">
            <div 
              className="absolute inset-0 w-full"
              style={{
                background: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0.1) 40%, transparent 70%), radial-gradient(circle, rgba(20, 184, 166, 0.2) 1px, transparent 1px)',
                backgroundSize: '100% 100%, 20px 20px'
              }}
            ></div>
          </div>
          <div ref={profileScrollRef} className="pt-18 px-6 pb-6 max-w-4xl mx-auto overflow-y-auto h-screen relative z-10">
            <Dashboard />
          </div>
        </>
      )}

      {sidebarTab === "browse" && (
<>
          <div className="fixed inset-0 pointer-events-none z-0">
            <div 
              className="absolute inset-0 w-full"
              style={{
                background: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0.1) 40%, transparent 70%), radial-gradient(circle, rgba(20, 184, 166, 0.2) 1px, transparent 1px)',
                backgroundSize: '100% 100%, 20px 20px'
              }}
            ></div>
          </div>
          <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative z-10">
<div className="flex-1 overflow-y-auto">
              <form className="p-3 border-b border-zinc-300 dark:border-zinc-700" onSubmit={handleSearch}>
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
                        onClick={() => openSearchResult(result)}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                            result.role === "user"
                              ? "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300"
                              : "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200"
                          }`}>
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

<h2 className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 font-mono">
                Projects
              </h2>
              <div className="flex-1 overflow-y-auto">
                {projects.map((project) => (
                  <div
                    key={project.path}
                    className={`px-4 py-3 cursor-pointer flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 ${
                      selectedProject?.path === project.path ? "bg-white dark:bg-zinc-800" : ""
                    }`}
                    onClick={() => loadSessions(project)}
                  >
                    <span className="text-sm font-medium truncate flex-1">{project.name}</span>
                    <span className="text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-2">
                      {project.session_count}
                    </span>
                  </div>
                ))}
              </div>

{selectedProject && (
                <>
                  <h2 className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 font-mono">
                    Sessions
                  </h2>
                  <div className="max-h-[40vh] overflow-y-auto">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`px-4 py-3 cursor-pointer border-b border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 ${
                          selectedSession?.id === session.id ? "bg-white dark:bg-zinc-800" : ""
                        }`}
                        onClick={() => loadMessages(session)}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {formatDate(session.modified)}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            ↓{formatTokens(session.input_tokens)} ↑{formatTokens(session.output_tokens)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

<div ref={browseScrollRef} className="flex-1 overflow-y-auto p-6 relative z-10">
            {loading && (
              <div className="flex justify-center items-center h-full text-zinc-500">
                Loading...
              </div>
            )}

            {!loading && selectedSession && (
<div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-mono font-semibold">
                    {viewMode === "messages" && `messages(${messages.length})`}
                    {viewMode === "snippets" && `code snippets (${extractCodeSnippets().length})`}
                    {viewMode === "context" && "session context"}
                  </h2>
                  <div className="flex gap-1">
                    {(["messages", "snippets", "context"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg border ${
                          viewMode === mode
                            ? "bg-teal-500 border-teal-500 text-white hover:bg-teal-600"
                            : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                        }`}
                        onClick={() => {
                          setViewMode(mode);
                          if (mode === "context" && !sessionContext) loadContext();
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

{viewMode === "messages" && (
                  <div className="flex flex-col gap-3 max-w-3xl mx-auto">
                    {messages.map((msg, idx) => (
                      <div
                        key={msg.uuid || idx}
                        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                          msg.message?.role === "user"
                            ? "self-end bg-zinc-700 text-white rounded-br-sm dark:bg-zinc-600"
                            : "self-start bg-white dark:bg-zinc-800 rounded-bl-sm border border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        <div className="flex justify-between items-center gap-3 mb-1.5">
                          <span className={`text-xs font-semibold uppercase opacity-70 ${
                            msg.message?.role === "user" ? "text-white/80" : "text-zinc-600 dark:text-zinc-400"
                          }`}>
                            {msg.message?.role}
                          </span>
                          <span className={`text-[10px] opacity-60 ${
                            msg.message?.role === "user" ? "text-white/70" : ""
                          }`}>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed">
                          <MessageRenderer content={getMessageText(msg)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

{viewMode === "snippets" && (
                  <div className="flex flex-col gap-4">
                    {extractCodeSnippets().map((snippet, idx) => (
                      <div key={idx} className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800">
                          <span className="text-xs font-semibold uppercase text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded">
                            {snippet.language}
                          </span>
                          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                            snippet.role === "user"
                              ? "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300"
                              : "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200"
                          }`}>
                            {snippet.role}
                          </span>
                          <button
                            className="ml-auto px-2.5 py-1 text-xs font-medium bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-600"
                            onClick={() => copyToClipboard(snippet.code)}
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
                )}

{viewMode === "context" && sessionContext && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
                        Modified files ({sessionContext.file_changes.length})
                      </h3>
                      <div className="flex flex-col gap-2">
                        {sessionContext.file_changes.length === 0 ? (
                          <p className="text-sm text-zinc-400 italic">No file modifications found.</p>
                        ) : (
                          [...new Map(sessionContext.file_changes.map((f) => [f.file_path, f])).values()].map((change, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                              <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                                change.action.toLowerCase().includes("edit")
                                  ? "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200"
                                  : "bg-zinc-500 text-white dark:bg-zinc-500 dark:text-zinc-100"
                              }`}>
                                {change.action}
                              </span>
                              <span className="text-xs font-mono break-all">{change.file_path}</span>
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
                          <p className="text-sm text-zinc-400 italic">No commits found in this time range.</p>
                        ) : (
                          sessionContext.git_commits.map((commit, idx) => (
                            <div key={idx} className="p-3 bg-white dark:bg-zinc-800 rounded-lg border-l-3 border-zinc-500">
                              <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                                  {commit.hash.slice(0, 7)}
                                </span>
                                <span className="text-sm font-medium">{commit.message}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {commit.files.map((file, fidx) => (
                                  <span key={fidx} className="text-xs font-mono bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400">
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
                )}

                {viewMode === "context" && !sessionContext && (
                  <div className="flex justify-center items-center py-8 text-zinc-500">
                    Loading context...
                  </div>
                )}
              </div>
            )}

            {!loading && !selectedSession && (
              <div className="flex justify-center items-center h-full text-zinc-400 text-base">
                Select a project and session to view messages.
              </div>
            )}

            {copyFeedback && (
              <div className="fixed bottom-6 right-6 px-5 py-2.5 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-sm font-medium animate-pulse shadow-lg">
                {copyFeedback}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default App;

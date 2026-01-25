import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MessageRenderer } from "./components/MessageRenderer";
import { Dashboard } from "./components/Dashboard";

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
    <main className={`flex h-screen overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${sidebarTab === "profile" ? "block" : ""}`}>
<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 bg-gray-200/70 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-gray-300/50 dark:border-white/10 shadow-lg">
        <button
          className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            sidebarTab === "profile"
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          }`}
          onClick={() => setSidebarTab("profile")}
        >
          Profile
        </button>
        <button
          className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            sidebarTab === "browse"
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          }`}
          onClick={() => setSidebarTab("browse")}
        >
          Browse
        </button>
      </div>

      {sidebarTab === "profile" && (
        <div className="pt-18 px-6 pb-6 max-w-4xl mx-auto overflow-y-auto h-screen">
          <Dashboard />
        </div>
      )}

      {sidebarTab === "browse" && (
<>
          <div className="w-80 border-r border-gray-300 dark:border-gray-700 flex flex-col overflow-hidden bg-gray-200 dark:bg-gray-800">
<div className="flex-1 overflow-y-auto">
              <form className="p-3 border-b border-gray-300 dark:border-gray-700" onSubmit={handleSearch}>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Search messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>

{searchResults.length > 0 && (
                <>
                  <h2 className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    Search results ({searchResults.length})
                  </h2>
                  <div className="max-h-72 overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-3 cursor-pointer border-b border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800"
                        onClick={() => openSearchResult(result)}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                            result.role === "user"
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                          }`}>
                            {result.role}
                          </span>
                          <span className="text-xs text-gray-400">
                            {result.project_name.split("/").pop()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {result.content_preview}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isSearching && (
                <div className="flex justify-center items-center py-8 text-gray-500">
                  Searching...
                </div>
              )}

<h2 className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                Projects
              </h2>
              <div className="flex-1 overflow-y-auto">
                {projects.map((project) => (
                  <div
                    key={project.path}
                    className={`px-4 py-3 cursor-pointer flex justify-between items-center border-b border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 ${
                      selectedProject?.path === project.path ? "bg-blue-50 dark:bg-blue-900/30" : ""
                    }`}
                    onClick={() => loadSessions(project)}
                  >
                    <span className="text-sm font-medium truncate flex-1">{project.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full ml-2">
                      {project.session_count}
                    </span>
                  </div>
                ))}
              </div>

{selectedProject && (
                <>
                  <h2 className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    Sessions
                  </h2>
                  <div className="max-h-[40vh] overflow-y-auto">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`px-4 py-3 cursor-pointer border-b border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 ${
                          selectedSession?.id === session.id ? "bg-blue-50 dark:bg-blue-900/30" : ""
                        }`}
                        onClick={() => loadMessages(session)}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {formatDate(session.modified)}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
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

<div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex justify-center items-center h-full text-gray-500">
                Loading...
              </div>
            )}

            {!loading && selectedSession && (
<div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-semibold">
                    {viewMode === "messages" && `messages (${messages.length})`}
                    {viewMode === "snippets" && `code snippets (${extractCodeSnippets().length})`}
                    {viewMode === "context" && "session context"}
                  </h2>
                  <div className="flex gap-1">
                    {(["messages", "snippets", "context"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                          viewMode === mode
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
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
                            ? "self-end bg-blue-500 text-white rounded-br-sm"
                            : "self-start bg-gray-200 dark:bg-gray-800 rounded-bl-sm"
                        }`}
                      >
                        <div className="flex justify-between items-center gap-3 mb-1.5">
                          <span className={`text-xs font-semibold uppercase opacity-70 ${
                            msg.message?.role === "user" ? "text-white/80" : "text-green-600 dark:text-green-400"
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
                      <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800">
                          <span className="text-xs font-semibold uppercase text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                            {snippet.language}
                          </span>
                          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                            snippet.role === "user"
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                          }`}>
                            {snippet.role}
                          </span>
                          <button
                            className="ml-auto px-2.5 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                            onClick={() => copyToClipboard(snippet.code)}
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="p-3 bg-gray-200 dark:bg-gray-900 text-sm leading-relaxed overflow-x-auto font-mono">
                          {snippet.code}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

{viewMode === "context" && sessionContext && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                        Modified files ({sessionContext.file_changes.length})
                      </h3>
                      <div className="flex flex-col gap-2">
                        {sessionContext.file_changes.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">No file modifications found.</p>
                        ) : (
                          [...new Map(sessionContext.file_changes.map((f) => [f.file_path, f])).values()].map((change, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                              <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                                change.action.toLowerCase().includes("edit")
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                  : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
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
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                        Git commits ({sessionContext.git_commits.length})
                      </h3>
                      <div className="flex flex-col gap-3">
                        {sessionContext.git_commits.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">No commits found in this time range.</p>
                        ) : (
                          sessionContext.git_commits.map((commit, idx) => (
                            <div key={idx} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border-l-3 border-blue-500">
                              <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                  {commit.hash.slice(0, 7)}
                                </span>
                                <span className="text-sm font-medium">{commit.message}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {commit.files.map((file, fidx) => (
                                  <span key={fidx} className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
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
                  <div className="flex justify-center items-center py-8 text-gray-500">
                    Loading context...
                  </div>
                )}
              </div>
            )}

            {!loading && !selectedSession && (
              <div className="flex justify-center items-center h-full text-gray-400 text-base">
                Select a project and session to view messages.
              </div>
            )}

            {copyFeedback && (
              <div className="fixed bottom-6 right-6 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium animate-pulse">
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

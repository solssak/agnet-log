import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MessageRenderer } from "./components/MessageRenderer";
import { Dashboard } from "./components/Dashboard";
import "./App.css";

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
    <main className={`app ${sidebarTab === "profile" ? "profile-mode" : ""}`}>
      <div className="floating-nav">
        <button
          className={`floating-nav-tab ${sidebarTab === "profile" ? "active" : ""}`}
          onClick={() => setSidebarTab("profile")}
        >
          Profile
        </button>
        <button
          className={`floating-nav-tab ${sidebarTab === "browse" ? "active" : ""}`}
          onClick={() => setSidebarTab("browse")}
        >
          Browse
        </button>
      </div>

      {sidebarTab === "profile" && (
        <div className="profile-view">
          <Dashboard />
        </div>
      )}

      {sidebarTab === "browse" && (
        <>
          <div className="sidebar">
            <div className="sidebar-content">
              <form className="search-form" onSubmit={handleSearch}>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>

              {searchResults.length > 0 && (
                <>
                  <h2>Search results ({searchResults.length})</h2>
                  <div className="search-results">
                    {searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="search-result-item"
                        onClick={() => openSearchResult(result)}
                      >
                        <div className="search-result-header">
                          <span className={`search-result-role ${result.role}`}>
                            {result.role}
                          </span>
                          <span className="search-result-project">
                            {result.project_name.split("/").pop()}
                          </span>
                        </div>
                        <div className="search-result-preview">
                          {result.content_preview}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isSearching && <div className="loading">Searching...</div>}

              <h2>Projects</h2>
              <div className="project-list">
                {projects.map((project) => (
                  <div
                    key={project.path}
                    className={`project-item ${selectedProject?.path === project.path ? "selected" : ""}`}
                    onClick={() => loadSessions(project)}
                  >
                    <span className="project-name">{project.name}</span>
                    <span className="session-count">
                      {project.session_count}
                    </span>
                  </div>
                ))}
              </div>

              {selectedProject && (
                <>
                  <h2>Sessions</h2>
                  <div className="session-list">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`session-item ${selectedSession?.id === session.id ? "selected" : ""}`}
                        onClick={() => loadMessages(session)}
                      >
                        <div className="session-info">
                          <span className="session-date">
                            {formatDate(session.modified)}
                          </span>
                          <span className="session-tokens">
                            ↓{formatTokens(session.input_tokens)} ↑
                            {formatTokens(session.output_tokens)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="content">
            {loading && <div className="loading">Loading...</div>}

            {!loading && selectedSession && (
              <div className="messages">
                <div className="content-header">
                  <h2>
                    {viewMode === "messages" && `messages (${messages.length})`}
                    {viewMode === "snippets" &&
                      `code snippets (${extractCodeSnippets().length})`}
                    {viewMode === "context" && "session context"}
                  </h2>
                  <div className="view-toggle">
                    <button
                      className={viewMode === "messages" ? "active" : ""}
                      onClick={() => setViewMode("messages")}
                    >
                      messages
                    </button>
                    <button
                      className={viewMode === "snippets" ? "active" : ""}
                      onClick={() => setViewMode("snippets")}
                    >
                      snippets
                    </button>
                    <button
                      className={viewMode === "context" ? "active" : ""}
                      onClick={() => {
                        setViewMode("context");
                        if (!sessionContext) loadContext();
                      }}
                    >
                      context
                    </button>
                  </div>
                </div>

                {viewMode === "messages" && (
                  <div className="messages-container">
                    {messages.map((msg, idx) => (
                      <div
                        key={msg.uuid || idx}
                        className={`message ${msg.message?.role || ""}`}
                      >
                        <div className="message-header">
                          <span className="message-role">
                            {msg.message?.role}
                          </span>
                          <span className="message-time">
                            {msg.timestamp
                              ? new Date(msg.timestamp).toLocaleTimeString()
                              : ""}
                          </span>
                        </div>
                        <div className="message-content">
                          <MessageRenderer content={getMessageText(msg)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewMode === "snippets" &&
                  extractCodeSnippets().map((snippet, idx) => (
                    <div key={idx} className="snippet">
                      <div className="snippet-header">
                        <span className="snippet-language">
                          {snippet.language}
                        </span>
                        <span className={`snippet-role ${snippet.role}`}>
                          {snippet.role}
                        </span>
                        <button
                          className="copy-button"
                          onClick={() => copyToClipboard(snippet.code)}
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="snippet-code">{snippet.code}</pre>
                    </div>
                  ))}

                {viewMode === "context" && sessionContext && (
                  <div className="context-view">
                    <div className="context-section">
                      <h3>
                        Modified files ({sessionContext.file_changes.length})
                      </h3>
                      <div className="file-changes">
                        {sessionContext.file_changes.length === 0 ? (
                          <p className="empty-state">
                            No file modifications found.
                          </p>
                        ) : (
                          [
                            ...new Map(
                              sessionContext.file_changes.map((f) => [
                                f.file_path,
                                f,
                              ]),
                            ).values(),
                          ].map((change, idx) => (
                            <div key={idx} className="file-change">
                              <span
                                className={`action-badge ${change.action.toLowerCase()}`}
                              >
                                {change.action}
                              </span>
                              <span className="file-path">
                                {change.file_path}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="context-section">
                      <h3>Git commits ({sessionContext.git_commits.length})</h3>
                      <div className="git-commits">
                        {sessionContext.git_commits.length === 0 ? (
                          <p className="empty-state">
                            No commits found in this time range.
                          </p>
                        ) : (
                          sessionContext.git_commits.map((commit, idx) => (
                            <div key={idx} className="git-commit">
                              <div className="commit-header">
                                <span className="commit-hash">
                                  {commit.hash.slice(0, 7)}
                                </span>
                                <span className="commit-message">
                                  {commit.message}
                                </span>
                              </div>
                              <div className="commit-files">
                                {commit.files.map((file, fidx) => (
                                  <span key={fidx} className="commit-file">
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
                  <div className="loading">Loading context...</div>
                )}
              </div>
            )}

            {!loading && !selectedSession && (
              <div className="placeholder">
                Select a project and session to view messages.
              </div>
            )}

            {copyFeedback && <div className="copy-toast">{copyFeedback}</div>}
          </div>
        </>
      )}
    </main>
  );
}

export default App;

export type Project = {
  name: string;
  path: string;
  session_count: number;
};

export type Session = {
  id: string;
  path: string;
  size: number;
  modified: number;
  input_tokens: number;
  output_tokens: number;
};

export type MessageContent = {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
};

export type Message = {
  msg_type?: string;
  uuid?: string;
  parent_uuid?: string;
  timestamp?: string;
  session_id?: string;
  message?: MessageContent;
};

export type SearchResult = {
  project_name: string;
  project_path: string;
  session_id: string;
  session_path: string;
  message_uuid: string;
  role: string;
  content_preview: string;
  timestamp: string;
};

export type FileChange = {
  file_path: string;
  action: string;
  timestamp: string;
};

export type GitCommit = {
  hash: string;
  message: string;
  timestamp: string;
  files: string[];
};

export type SessionContext = {
  file_changes: FileChange[];
  git_commits: GitCommit[];
  project_path: string;
};

export type CodeSnippet = {
  language: string;
  code: string;
  role: string;
  timestamp: string;
};

export type ViewMode = "messages" | "snippets" | "context";
export type SidebarTab = "profile" | "browse";

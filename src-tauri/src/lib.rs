use chrono::{Datelike, Timelike};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub path: String,
    pub session_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Deserialize)]
struct RawMessage {
    message: Option<RawMessageContent>,
}

#[derive(Debug, Deserialize)]
struct RawMessageContent {
    usage: Option<TokenUsage>,
}

#[derive(Debug, Deserialize)]
struct TokenUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub message: Option<MessageContent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageContent {
    pub role: Option<String>,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct TranscriptMessage {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    timestamp: Option<String>,
    content: Option<String>,
}

fn get_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude"))
}

#[tauri::command]
fn get_projects() -> Result<Vec<Project>, String> {
    let claude_dir = get_claude_dir().ok_or("Could not find home directory")?;
    let projects_dir = claude_dir.join("projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = vec![];

    let entries = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let session_count = fs::read_dir(&path)
                .map(|entries| {
                    entries
                        .flatten()
                        .filter(|e| {
                            e.path()
                                .extension()
                                .map(|ext| ext == "jsonl")
                                .unwrap_or(false)
                        })
                        .count()
                })
                .unwrap_or(0);

            if session_count > 0 {
                projects.push(Project {
                    name: name.replace('-', "/").trim_start_matches('/').to_string(),
                    path: path.to_string_lossy().to_string(),
                    session_count,
                });
            }
        }
    }

    let transcripts_dir = claude_dir.join("transcripts");
    if transcripts_dir.exists() {
        let session_count = fs::read_dir(&transcripts_dir)
            .map(|entries| {
                entries
                    .flatten()
                    .filter(|e| {
                        e.path()
                            .extension()
                            .map(|ext| ext == "jsonl")
                            .unwrap_or(false)
                    })
                    .count()
            })
            .unwrap_or(0);

        if session_count > 0 {
            projects.push(Project {
                name: "OpenCode Sessions".to_string(),
                path: transcripts_dir.to_string_lossy().to_string(),
                session_count,
            });
        }
    }

    projects.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(projects)
}

#[tauri::command]
fn get_sessions(project_path: String) -> Result<Vec<Session>, String> {
    let path = PathBuf::from(&project_path);

    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let mut sessions = vec![];

    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let file_path = entry.path();
        if file_path
            .extension()
            .map(|ext| ext == "jsonl")
            .unwrap_or(false)
        {
            let id = file_path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
            let size = metadata.len();
            let modified = metadata
                .modified()
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0)
                })
                .unwrap_or(0);

            let (input_tokens, output_tokens, message_count) = calculate_session_stats(&file_path);

            if message_count > 0 {
                sessions.push(Session {
                    id,
                    path: file_path.to_string_lossy().to_string(),
                    size,
                    modified,
                    input_tokens,
                    output_tokens,
                });
            }
        }
    }

    sessions.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(sessions)
}

fn calculate_session_stats(path: &PathBuf) -> (u64, u64, u32) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return (0, 0, 0),
    };

    let mut input_tokens = 0u64;
    let mut output_tokens = 0u64;
    let mut message_count = 0u32;

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let mut parsed = false;

        if let Ok(msg) = serde_json::from_str::<Message>(line) {
            if let Some(ref msg_type) = msg.msg_type {
                if (msg_type == "user" || msg_type == "assistant") && has_text_content(&msg.message)
                {
                    message_count += 1;
                    parsed = true;
                }
            }
        }

        if !parsed {
            if let Ok(transcript_msg) = serde_json::from_str::<TranscriptMessage>(line) {
                if let Some(ref msg_type) = transcript_msg.msg_type {
                    if msg_type == "user" {
                        if let Some(ref content) = transcript_msg.content {
                            if !content.trim().is_empty() {
                                message_count += 1;
                            }
                        }
                    }
                }
            }
        }

        if let Ok(msg) = serde_json::from_str::<RawMessage>(line) {
            if let Some(message) = msg.message {
                if let Some(usage) = message.usage {
                    input_tokens += usage.input_tokens.unwrap_or(0);
                    output_tokens += usage.output_tokens.unwrap_or(0);
                }
            }
        }
    }

    (input_tokens, output_tokens, message_count)
}

#[tauri::command]
fn get_messages(session_path: String) -> Result<Vec<Message>, String> {
    let path = PathBuf::from(&session_path);

    if !path.exists() {
        return Err("Session file does not exist".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut messages = vec![];

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let mut parsed = false;

        if let Ok(msg) = serde_json::from_str::<Message>(line) {
            if let Some(ref msg_type) = msg.msg_type {
                if msg_type == "user" || msg_type == "assistant" {
                    if has_text_content(&msg.message) {
                        messages.push(msg);
                        parsed = true;
                    }
                }
            }
        }

        if !parsed {
            if let Ok(transcript_msg) = serde_json::from_str::<TranscriptMessage>(line) {
                if let Some(ref msg_type) = transcript_msg.msg_type {
                    if msg_type == "user" {
                        if let Some(ref content) = transcript_msg.content {
                            if !content.trim().is_empty() {
                                let converted_msg = Message {
                                    msg_type: transcript_msg.msg_type.clone(),
                                    uuid: None,
                                    parent_uuid: None,
                                    timestamp: transcript_msg.timestamp.clone(),
                                    session_id: None,
                                    message: Some(MessageContent {
                                        role: Some("user".to_string()),
                                        content: Some(serde_json::Value::String(content.clone())),
                                    }),
                                };
                                messages.push(converted_msg);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(messages)
}

fn has_text_content(message: &Option<MessageContent>) -> bool {
    let Some(msg) = message else {
        return false;
    };
    let Some(content) = &msg.content else {
        return false;
    };

    match content {
        serde_json::Value::String(s) => !s.trim().is_empty(),
        serde_json::Value::Array(arr) => arr.iter().any(|item| {
            if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                item.get("text")
                    .and_then(|t| t.as_str())
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false)
            } else {
                false
            }
        }),
        _ => false,
    }
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub project_name: String,
    pub project_path: String,
    pub session_id: String,
    pub session_path: String,
    pub message_uuid: String,
    pub role: String,
    pub content_preview: String,
    pub timestamp: String,
}

#[tauri::command]
fn search_messages(query: String) -> Result<Vec<SearchResult>, String> {
    let claude_dir = get_claude_dir().ok_or("Could not find home directory")?;
    let projects_dir = claude_dir.join("projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let query_lower = query.to_lowercase();
    let mut results = vec![];

    let project_entries = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;

    for project_entry in project_entries.flatten() {
        let project_path = project_entry.path();
        if !project_path.is_dir() {
            continue;
        }

        let project_name = project_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .replace('-', "/")
            .trim_start_matches('/')
            .to_string();

        let session_entries = match fs::read_dir(&project_path) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for session_entry in session_entries.flatten() {
            let session_path = session_entry.path();
            if !session_path
                .extension()
                .map(|e| e == "jsonl")
                .unwrap_or(false)
            {
                continue;
            }

            let session_id = session_path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let content = match fs::read_to_string(&session_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            for line in content.lines() {
                if line.trim().is_empty() {
                    continue;
                }

                if !line.to_lowercase().contains(&query_lower) {
                    continue;
                }

                if let Ok(msg) = serde_json::from_str::<Message>(line) {
                    let msg_type = msg.msg_type.as_deref().unwrap_or("");
                    if msg_type != "user" && msg_type != "assistant" {
                        continue;
                    }

                    let text = extract_text_content(&msg.message);
                    if !text.to_lowercase().contains(&query_lower) {
                        continue;
                    }

                    let preview = create_preview(&text, &query_lower, 100);

                    results.push(SearchResult {
                        project_name: project_name.clone(),
                        project_path: project_path.to_string_lossy().to_string(),
                        session_id: session_id.clone(),
                        session_path: session_path.to_string_lossy().to_string(),
                        message_uuid: msg.uuid.unwrap_or_default(),
                        role: msg
                            .message
                            .as_ref()
                            .and_then(|m| m.role.clone())
                            .unwrap_or_default(),
                        content_preview: preview,
                        timestamp: msg.timestamp.unwrap_or_default(),
                    });
                }
            }
        }
    }

    results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    results.truncate(100);

    Ok(results)
}

fn extract_text_content(message: &Option<MessageContent>) -> String {
    let Some(msg) = message else {
        return String::new();
    };
    let Some(content) = &msg.content else {
        return String::new();
    };

    match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => arr
            .iter()
            .filter_map(|item| {
                if item.get("type")?.as_str()? == "text" {
                    item.get("text")?.as_str().map(String::from)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn create_preview(text: &str, query: &str, max_len: usize) -> String {
    let text_lower = text.to_lowercase();
    if let Some(pos) = text_lower.find(query) {
        let start = pos.saturating_sub(30);
        let end = (pos + query.len() + 70).min(text.len());
        let mut preview = text[start..end].to_string();
        if start > 0 {
            preview = format!("...{}", preview);
        }
        if end < text.len() {
            preview = format!("{}...", preview);
        }
        preview.replace('\n', " ")
    } else {
        let preview: String = text.chars().take(max_len).collect();
        if text.len() > max_len {
            format!("{}...", preview)
        } else {
            preview
        }
    }
}

#[derive(Debug, Serialize)]
pub struct FileChange {
    pub file_path: String,
    pub action: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub timestamp: String,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionContext {
    pub file_changes: Vec<FileChange>,
    pub git_commits: Vec<GitCommit>,
    pub project_path: String,
}

#[tauri::command]
fn get_session_context(
    session_path: String,
    project_name: String,
) -> Result<SessionContext, String> {
    let path = PathBuf::from(&session_path);

    if !path.exists() {
        return Err("Session file does not exist".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut file_changes: Vec<FileChange> = vec![];
    let mut timestamps: Vec<String> = vec![];

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let timestamp = json
            .get("timestamp")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string();

        if !timestamp.is_empty() {
            timestamps.push(timestamp.clone());
        }

        let content_arr = match json
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_array())
        {
            Some(arr) => arr,
            None => continue,
        };

        for item in content_arr {
            if item.get("type").and_then(|t| t.as_str()) != Some("tool_use") {
                continue;
            }

            let tool_name = item.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let input = item.get("input");

            let file_path = match tool_name {
                "Edit" | "Write" => input
                    .and_then(|i| i.get("file_path"))
                    .and_then(|f| f.as_str()),
                "mcp_edit" | "mcp_write" => input
                    .and_then(|i| i.get("filePath"))
                    .and_then(|f| f.as_str()),
                _ => None,
            };

            if let Some(fp) = file_path {
                file_changes.push(FileChange {
                    file_path: fp.to_string(),
                    action: tool_name.to_string(),
                    timestamp: timestamp.clone(),
                });
            }
        }
    }

    let project_path = format!("/{}", project_name);
    let git_commits = get_git_commits(&project_path, &timestamps);

    Ok(SessionContext {
        file_changes,
        git_commits,
        project_path,
    })
}

fn get_git_commits(project_path: &str, timestamps: &[String]) -> Vec<GitCommit> {
    if timestamps.is_empty() {
        return vec![];
    }

    let start_time = timestamps.iter().min().cloned().unwrap_or_default();
    let end_time = timestamps.iter().max().cloned().unwrap_or_default();

    if start_time.is_empty() || end_time.is_empty() {
        return vec![];
    }

    let output = match std::process::Command::new("git")
        .args([
            "log",
            "--format=%H|%s|%aI",
            "--name-only",
            &format!("--since={}", start_time),
            &format!("--until={}", end_time),
        ])
        .current_dir(project_path)
        .output()
    {
        Ok(o) => o,
        Err(_) => return vec![],
    };

    if !output.status.success() {
        return vec![];
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = vec![];
    let mut current_commit: Option<GitCommit> = None;

    for line in stdout.lines() {
        if line.contains('|') {
            if let Some(commit) = current_commit.take() {
                commits.push(commit);
            }

            let parts: Vec<&str> = line.splitn(3, '|').collect();
            if parts.len() >= 3 {
                current_commit = Some(GitCommit {
                    hash: parts[0].to_string(),
                    message: parts[1].to_string(),
                    timestamp: parts[2].to_string(),
                    files: vec![],
                });
            }
        } else if !line.trim().is_empty() {
            if let Some(ref mut commit) = current_commit {
                commit.files.push(line.trim().to_string());
            }
        }
    }

    if let Some(commit) = current_commit {
        commits.push(commit);
    }

    commits
}

#[derive(Debug, Serialize)]
pub struct DailyStats {
    pub date: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub session_count: u32,
    pub message_count: u32,
}

#[derive(Debug, Serialize)]
pub struct HourlyActivity {
    pub hour: u8,
    pub day: u8,
    pub count: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectStats {
    pub name: String,
    pub path: String,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub session_count: u32,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_sessions: u32,
    pub total_messages: u32,
    pub daily_stats: Vec<DailyStats>,
    pub hourly_activity: Vec<HourlyActivity>,
    pub project_stats: Vec<ProjectStats>,
    pub estimated_cost: f64,
    pub avg_session_minutes: f64,
}

#[tauri::command]
fn get_dashboard_stats() -> Result<DashboardStats, String> {
    let claude_dir = get_claude_dir().ok_or("Could not find home directory")?;
    let projects_dir = claude_dir.join("projects");

    if !projects_dir.exists() {
        return Ok(DashboardStats {
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_sessions: 0,
            total_messages: 0,
            daily_stats: vec![],
            hourly_activity: vec![],
            project_stats: vec![],
            estimated_cost: 0.0,
            avg_session_minutes: 0.0,
        });
    }

    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut total_sessions = 0u32;
    let mut total_messages = 0u32;
    let mut total_session_duration_secs = 0i64;
    let mut sessions_with_duration = 0u32;
    let mut daily_map: std::collections::HashMap<String, DailyStats> =
        std::collections::HashMap::new();
    let mut hourly_map: std::collections::HashMap<(u8, u8), u32> = std::collections::HashMap::new();
    let mut project_stats: Vec<ProjectStats> = vec![];

    let project_entries = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;

    for project_entry in project_entries.flatten() {
        let project_path = project_entry.path();
        if !project_path.is_dir() {
            continue;
        }

        let project_name = project_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .replace('-', "/")
            .trim_start_matches('/')
            .to_string();

        let mut proj_input = 0u64;
        let mut proj_output = 0u64;
        let mut proj_sessions = 0u32;

        let session_entries = match fs::read_dir(&project_path) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for session_entry in session_entries.flatten() {
            let session_path = session_entry.path();
            if !session_path
                .extension()
                .map(|e| e == "jsonl")
                .unwrap_or(false)
            {
                continue;
            }

            proj_sessions += 1;
            total_sessions += 1;

            let content = match fs::read_to_string(&session_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let mut session_first_ts: Option<chrono::DateTime<chrono::FixedOffset>> = None;
            let mut session_last_ts: Option<chrono::DateTime<chrono::FixedOffset>> = None;

            for line in content.lines() {
                if line.trim().is_empty() {
                    continue;
                }

                let json: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let msg_type = json.get("type").and_then(|t| t.as_str()).unwrap_or("");
                if msg_type == "user" || msg_type == "assistant" {
                    total_messages += 1;

                    if let Some(timestamp) = json.get("timestamp").and_then(|t| t.as_str()) {
                        if let Some(date) = timestamp.split('T').next() {
                            let entry = daily_map.entry(date.to_string()).or_insert(DailyStats {
                                date: date.to_string(),
                                input_tokens: 0,
                                output_tokens: 0,
                                session_count: 0,
                                message_count: 0,
                            });
                            entry.message_count += 1;
                        }

                        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(timestamp) {
                            let hour = dt.hour() as u8;
                            let day = dt.weekday().num_days_from_monday() as u8;
                            *hourly_map.entry((hour, day)).or_insert(0) += 1;

                            if session_first_ts.is_none() {
                                session_first_ts = Some(dt);
                            }
                            session_last_ts = Some(dt);
                        }
                    }
                }

                if let Some(usage) = json.get("message").and_then(|m| m.get("usage")) {
                    let input = usage
                        .get("input_tokens")
                        .and_then(|t| t.as_u64())
                        .unwrap_or(0);
                    let output = usage
                        .get("output_tokens")
                        .and_then(|t| t.as_u64())
                        .unwrap_or(0);

                    total_input_tokens += input;
                    total_output_tokens += output;
                    proj_input += input;
                    proj_output += output;

                    if let Some(timestamp) = json.get("timestamp").and_then(|t| t.as_str()) {
                        if let Some(date) = timestamp.split('T').next() {
                            let entry = daily_map.entry(date.to_string()).or_insert(DailyStats {
                                date: date.to_string(),
                                input_tokens: 0,
                                output_tokens: 0,
                                session_count: 0,
                                message_count: 0,
                            });
                            entry.input_tokens += input;
                            entry.output_tokens += output;
                        }
                    }
                }
            }

            if let (Some(first), Some(last)) = (session_first_ts, session_last_ts) {
                let duration = last.signed_duration_since(first);
                if duration.num_seconds() > 0 {
                    total_session_duration_secs += duration.num_seconds();
                    sessions_with_duration += 1;
                }
            }
        }

        if proj_sessions > 0 {
            project_stats.push(ProjectStats {
                name: project_name,
                path: project_path.to_string_lossy().to_string(),
                total_input_tokens: proj_input,
                total_output_tokens: proj_output,
                session_count: proj_sessions,
            });
        }
    }

    let mut daily_stats: Vec<DailyStats> = daily_map.into_values().collect();
    daily_stats.sort_by(|a, b| a.date.cmp(&b.date));

    let mut hourly_activity: Vec<HourlyActivity> = hourly_map
        .into_iter()
        .map(|((hour, day), count)| HourlyActivity { hour, day, count })
        .collect();
    hourly_activity.sort_by(|a, b| (a.day, a.hour).cmp(&(b.day, b.hour)));

    project_stats.sort_by(|a, b| {
        (b.total_input_tokens + b.total_output_tokens)
            .cmp(&(a.total_input_tokens + a.total_output_tokens))
    });

    let estimated_cost = (total_input_tokens as f64 * 0.003 / 1000.0)
        + (total_output_tokens as f64 * 0.015 / 1000.0);

    let avg_session_minutes = if sessions_with_duration > 0 {
        (total_session_duration_secs as f64 / sessions_with_duration as f64) / 60.0
    } else {
        0.0
    };

    Ok(DashboardStats {
        total_input_tokens,
        total_output_tokens,
        total_sessions,
        total_messages,
        daily_stats,
        hourly_activity,
        project_stats,
        estimated_cost,
        avg_session_minutes,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_projects,
            get_sessions,
            get_messages,
            search_messages,
            get_session_context,
            get_dashboard_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

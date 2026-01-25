# Agent Log

A desktop app to browse and search your Claude conversation history.

## Download

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Download .dmg](https://github.com/solssak/agnet-log/releases/latest/download/agent-log_aarch64.dmg) |
| macOS (Intel) | [Download .dmg](https://github.com/solssak/agnet-log/releases/latest/download/agent-log_x64.dmg) |
| Windows | [Download .msi](https://github.com/solssak/agnet-log/releases/latest/download/agent-log_x64-setup.msi) |
| Linux | [Download .AppImage](https://github.com/solssak/agnet-log/releases/latest/download/agent-log_amd64.AppImage) |

Or visit the [Releases page](https://github.com/solssak/agnet-log/releases) for all versions.

## Features

- Browse all your Claude projects and sessions
- Search across all conversations
- View messages in a chat-style UI
- Extract code snippets from conversations
- See file changes and git commits from sessions
- Dashboard with usage statistics

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run tauri dev

# Build for production
npm run tauri build
```

## Tech Stack

- [Tauri](https://tauri.app/) - Desktop framework
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Language
- [Vite](https://vitejs.dev/) - Build tool

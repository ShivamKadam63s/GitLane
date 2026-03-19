<div align="center">

<img src="src-tauri/icons/128x128.png" alt="GitLane Logo" width="96" height="96" />

# GitLane

**A professional desktop Git client built for developers who work anywhere.**

[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-blue?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/backend-Rust-orange?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/frontend-React%2018-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078d4?logo=windows&logoColor=white)](https://github.com/ShivamKadam63s/GitLane/releases)

[Download](#installation) · [Features](#features) · [How P2P Works](#how-p2p-transfer-works) · [Contributing](#contributing)

</div>

---

## What is GitLane?

GitLane is an offline-first desktop Git client that gives you full Git workflow — commits, branches, diffs, history, push/pull — without ever requiring an internet connection. When you do need to share code, GitLane can transfer entire repositories **directly between laptops** over your local network, using a QR code handshake — no GitHub, no USB drives, no internet required.

Most Git clients treat offline as a degraded state. GitLane treats it as the default.

> **Built for:** Hackathons, conferences, travel, weak-network environments, and any developer who wants a fast, lightweight Git client that doesn't phone home.

---

## Features

### Core Git Workflow

| Feature | Description |
|---|---|
| **Repository management** | Open, clone, create, and switch between multiple repositories |
| **File staging** | Stage individual files, hunks, or everything at once |
| **Diff viewer** | Syntax-highlighted unified diff with line numbers |
| **Commit creation** | Commit with author identity read from settings or `~/.gitconfig` |
| **Commit history** | Visual commit graph with branch lanes, author avatars, and timestamps |
| **Commit detail** | Click any commit to see all changed files with inline diffs |
| **Revert commits** | Non-destructive revert — creates a new undo commit |
| **Branch management** | Create, switch, delete, and rename branches |
| **Merge branches** | Merge with fast-forward detection and conflict reporting |
| **Stash** | Push and pop stash entries without leaving the UI |
| **Auto-refresh** | Detects file changes from VS Code or any editor within 3 seconds |

### Remote Operations

| Feature | Description |
|---|---|
| **Clone from URL** | Clone any public or private HTTPS repository |
| **Push / Pull / Fetch** | Full remote sync with progress indicators |
| **Credential storage** | Save GitHub/GitLab tokens per host — enter once, never again |
| **Auth error recovery** | When authentication fails, prompts for credentials and retries automatically |

### P2P Transfer (Signature Feature)

| Feature | Description |
|---|---|
| **Git bundle export** | Packs an entire repository — all commits, branches, history — into one portable file |
| **Local HTTP server** | Serves the bundle over your LAN at 20–50 MB/s |
| **QR code handshake** | Encodes connection details into a scannable QR — no IP typing required |
| **mDNS discovery** | Automatically finds other GitLane instances on the same Wi-Fi network |
| **Verified import** | Integrity-checks every transferred object before writing to disk |
| **No internet needed** | Works over any local network, mobile hotspot, or direct Wi-Fi connection |

---

## Why GitLane Instead of GitHub Desktop or GitKraken?

| | GitHub Desktop | GitKraken | **GitLane** |
|---|:---:|:---:|:---:|
| Free forever | ✅ | ❌ ($4.95/mo) | ✅ |
| Works fully offline | Partial | Partial | ✅ |
| Installer size | ~90 MB | ~100 MB | **~10 MB** |
| RAM usage | ~300 MB | ~500 MB | **~30 MB** |
| P2P repo transfer | ❌ | ❌ | ✅ |
| Built on Electron | ✅ | ✅ | ❌ (Tauri) |
| Open source | ✅ | ❌ | ✅ |

GitLane uses Tauri instead of Electron, which means it uses your OS's built-in WebView rather than bundling a full Chromium browser. The result is a 10× smaller memory footprint and an 8× smaller installer.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitLane Desktop App                           │
│                                                                  │
│  ┌───────────────────────────────┐  ┌────────────────────────┐  │
│  │   Frontend (React + TypeScript)│  │  Backend (Rust + Tauri) │  │
│  │                               │  │                        │  │
│  │  Pages                        │  │  Commands              │  │
│  │  ├─ RepoListPage              │  │  ├─ git.rs             │  │
│  │  ├─ RepoDetailPage            │  │  ├─ branch.rs          │  │
│  │  └─ SettingsPage              │  │  ├─ diff.rs            │  │
│  │                               │  │  ├─ repo.rs            │  │
│  │  Components                   │  │  ├─ remote.rs          │  │
│  │  ├─ CommitGraph               │  │  └─ transfer.rs        │  │
│  │  ├─ DiffViewer                │  │                        │  │
│  │  ├─ FileTree                  │◄─►│  libgit2 (via git2-rs)│  │
│  │  ├─ SyncBar                   │  │  tiny_http             │  │
│  │  ├─ ClonePanel                │  │  mdns-sd               │  │
│  │  └─ TransferPanel             │  │  qrcode                │  │
│  │                               │  │                        │  │
│  │  State (Zustand)              │  │  Tauri IPC Bridge      │  │
│  │  ├─ repoStore                 │  │  (invoke / emit)       │  │
│  │  └─ uiStore                   │  │                        │  │
│  └───────────────────────────────┘  └────────────────────────┘  │
│                                              │                   │
│                                    ┌─────────▼──────────┐       │
│                                    │  .git folder        │       │
│                                    │  (your disk)        │       │
│                                    └────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow for every Git operation:**

```
User clicks UI
    → TypeScript calls invoke('command_name', { args })
    → Tauri IPC serializes to JSON, routes to Rust
    → Rust uses libgit2 to read/write the .git folder
    → Returns structured data to TypeScript
    → React re-renders with new state
```

No subprocesses. No `git.exe` calls. Direct libgit2 bindings mean operations run in-process, fast and offline.

---

## Tech Stack

### Backend
| Technology | Version | Role |
|---|---|---|
| **Rust** | 1.88+ | Systems language for the backend process |
| **Tauri** | 2.0 | Desktop app framework, IPC bridge |
| **git2-rs** | 0.19 | Rust bindings to libgit2 (the Git engine) |
| **libgit2** | 1.8.1 | C library implementing Git — same used by GitHub |
| **tiny_http** | 0.12 | Zero-dependency HTTP server for P2P transfer |
| **mdns-sd** | 0.11 | mDNS/Bonjour for local network device discovery |
| **qrcode** | 0.14 | QR code generation for connection handshake |
| **serde** | 1.x | JSON serialization between Rust and TypeScript |

### Frontend
| Technology | Version | Role |
|---|---|---|
| **React** | 18 | UI component framework |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Vite** | 5.x | Dev server and build tool |
| **Zustand** | 4.x | Lightweight global state management |
| **jsQR** | — | QR code scanning from webcam in browser |

---

## Installation

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Rust | 1.75+ | https://rustup.rs |
| VS Build Tools | 2022 | https://visualstudio.microsoft.com/visual-cpp-build-tools/ |
| WebView2 | Any | Pre-installed on Windows 11 |

> **Windows only:** During VS Build Tools installation, select **"Desktop development with C++"**. This is required for Rust to compile.

### Install from source

```powershell
# 1. Clone the repository
git clone https://github.com/ShivamKadam63s/GitLane.git
cd GitLane

# 2. Install JavaScript dependencies
npm install

# 3. Run in development mode
npm run tauri dev
```

First build compiles Rust and downloads libgit2 (~3–5 minutes). Subsequent starts take under 30 seconds.

### Build the installer

```powershell
npm run tauri build
```

Produces `src-tauri\target\release\bundle\nsis\GitLane_0.1.0_x64-setup.exe` — a standard Windows installer (~10 MB).

### Docker (web UI only)

```bash
docker compose up --build
```

Opens the GitLane frontend at `http://localhost:3000`. Note: Git operations require the desktop build. Docker serves the UI layer only.

---

## Usage Guide

### Opening a repository

1. Launch GitLane
2. Click **+ Open folder** and navigate to any folder containing a `.git` directory
3. The repository appears in the sidebar and home screen

### Making a commit

1. Open a repository and go to the **Files** tab
2. Edit any file in VS Code (or any editor) — it appears in **Changes** within 3 seconds
3. Click **+** next to a file to stage it, or **Stage all** to stage everything
4. Type a commit message in the bottom panel
5. Click **Commit** — the new commit appears in the History tab immediately

### Viewing history

1. Click the **History** tab
2. The left panel shows the visual commit graph with branch lanes
3. Click any commit to open the detail panel showing author, date, SHA, and all changed files
4. Click any file in the detail panel to expand its inline diff
5. Click **↩ Revert** to create a new commit that undoes that commit's changes

### Branch operations

1. Go to the **Branches** tab
2. Click **+ New branch** to create a branch from current HEAD
3. Click any branch row to select it, then use **checkout** to switch
4. **delete** removes local branches (with confirmation)

### Push and Pull

1. Open a repository that has a remote (cloned from GitHub, etc.)
2. The bottom bar shows **Fetch**, **↓ Pull**, **↑ Push** buttons
3. Click **↑ Push** — if this is your first push, a credential modal appears
4. Enter your GitHub username and a Personal Access Token
5. Click **Save & retry** — credentials are saved and push completes
6. Future push/pull operations use saved credentials automatically

> **Generating a GitHub token:** Settings → Developer settings → Personal access tokens → Generate new token. Required scope: `repo`.

### Cloning a repository

1. Click **Clone URL** on the home screen
2. Enter any HTTPS Git URL (e.g. `https://github.com/user/repo.git`)
3. Click **Browse** to choose where to clone
4. Click **Clone** — the repository opens automatically on completion

---

## How P2P Transfer Works

GitLane can transfer a complete repository — including all commits, branches, and history — directly between two laptops on the same network with no internet connection.

### Step-by-step

```
Sender laptop                          Receiver laptop
─────────────────                      ─────────────────
1. Click "Share repo"
2. GitLane packs the entire
   .git folder into a bundle file
   using git2's packbuilder API
3. Starts an HTTP server on
   port 7878 with a random token
4. Broadcasts via mDNS:
   "GitLane has my-project"
5. Generates a QR code encoding:
   { ip, port, token, repoName }
6. Displays QR on screen
                                        7. Click "Receive repo"
                                        8. Choose:
                                           a) Scan QR with webcam, or
                                           b) See auto-discovered repos
                                              from mDNS list
                                        9. Select destination folder
                                       10. GitLane downloads bundle
                                           via HTTP (20–50 MB/s on WiFi)
                                       11. Verifies every object hash
                                       12. Imports into full .git folder
                                       13. Opens the received repository
7. "Transfer complete ✓"               14. Full history available offline
```

### Why this is different

Every existing Git client (GitHub Desktop, Sourcetree, GitKraken, Tower) requires internet access to share code. GitLane's P2P transfer works:

- At a hackathon with congested Wi-Fi
- On an airplane over a mobile hotspot
- In a conference room without Wi-Fi
- Anywhere two laptops can see each other on a local network

The transferred bundle is a standard Git format — after import, the repository behaves exactly like one cloned from GitHub. You can push it to a remote later when internet is available.

---

## Project Structure

```
GitLane/
├── src/                          # React frontend
│   ├── components/               # Reusable UI components
│   │   ├── CommitGraph.tsx       # Visual commit history with branch lanes
│   │   ├── DiffViewer.tsx        # File diff renderer
│   │   ├── FileTree.tsx          # Repository file browser
│   │   ├── SyncBar.tsx           # Push/Pull/Fetch status bar
│   │   ├── ClonePanel.tsx        # Clone from URL modal
│   │   ├── TransferPanel.tsx     # P2P transfer UI
│   │   └── CredentialModal.tsx   # Auth token entry
│   ├── pages/                    # Full-screen views
│   │   ├── RepoListPage.tsx      # Home — repository grid
│   │   ├── RepoDetailPage.tsx    # Files, History, Branches tabs
│   │   └── SettingsPage.tsx      # User preferences
│   ├── store/                    # Zustand state
│   │   ├── repoStore.ts          # Repository data and live status
│   │   └── uiStore.ts            # Navigation and UI state
│   ├── lib/git/                  # TypeScript bridge to Rust commands
│   │   ├── commits.ts
│   │   ├── branches.ts
│   │   ├── diff.ts
│   │   ├── remote.ts
│   │   └── transfer.ts
│   └── hooks/                    # Custom React hooks
│       ├── useRepo.ts            # Auto-polling for file changes
│       ├── useDiff.ts            # Diff fetching with race-condition fix
│       └── useCommitLog.ts       # Paginated commit history
│
├── src-tauri/                    # Rust backend
│   └── src/commands/
│       ├── git.rs                # Core Git operations
│       ├── branch.rs             # Branch management
│       ├── diff.rs               # Diff and file content
│       ├── repo.rs               # Repository metadata and settings
│       ├── remote.rs             # Push/Pull/Fetch with credentials
│       └── transfer.rs           # P2P bundle export/import/server
│
├── Dockerfile                    # Web UI container
├── docker-compose.yml
└── README.md
```

---

## Contributing

Contributions are welcome. Please follow these steps:

### Setting up for development

```powershell
git clone https://github.com/ShivamKadam63s/GitLane.git
cd GitLane
npm install
npm run tauri dev
```

### Guidelines

- **Rust code:** Run `cargo clippy` before committing. Fix all warnings.
- **TypeScript:** The project uses strict TypeScript. No `any` types except where explicitly necessary.
- **Commits:** Use conventional commit format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Branch naming:** `feat/feature-name`, `fix/bug-description`

### Pull request process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes with clear commit messages
4. Open a pull request with a description of what you changed and why

### Reporting bugs

Open an issue with:
- Your OS version
- GitLane version
- Steps to reproduce
- What you expected vs what happened
- Any error messages from the app or the terminal

---

## Future Improvements

These are planned but not yet implemented:

- **Merge conflict resolution UI** — three-panel view for resolving conflicts visually
- **Interactive rebase** — squash, fixup, reorder commits with a drag interface
- **SSH key support** — manage SSH keys for private repo access without tokens
- **Commit search** — full-text search across all commits by message or author
- **Cherry-pick** — apply specific commits from one branch to another
- **Light and system themes** — currently dark only
- **Bluetooth transfer** — fallback P2P transfer when no Wi-Fi is available
- **macOS and Linux builds** — Tauri supports all platforms; packaging is the remaining work

---

## License

```
MIT License

Copyright (c) 2025 Shivam Kadam

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

Built with Rust, React, and libgit2 · Made for developers who work offline

[⭐ Star on GitHub](https://github.com/ShivamKadam63s/GitLane) · [🐛 Report a Bug](https://github.com/ShivamKadam63s/GitLane/issues) · [💡 Request a Feature](https://github.com/ShivamKadam63s/GitLane/issues)

</div>
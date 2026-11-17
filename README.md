# MemBridge — Universal AI Memory Teleport

Move your **identity, active projects, tech stack, preferences, and rules** across **ChatGPT, Claude, Gemini, DeepSeek, Grok, and coding agents** in 1 click—**100% locally** in your browser with zero cloud uploads.

```mermaid
flowchart LR
  A["ChatGPT / Claude / Gemini / Text"] -->|"Drop file or Quick-Extract"| B["MemBridge Smart Distiller"]
  B -->|"Categorize + Secret Redact"| C["Visual Brain Editor"]
  C -->|"1-Click Format"| D["Claude XML"]
  C -->|"1-Click Format"| E["ChatGPT Custom Instructions"]
  C -->|"1-Click Format"| F["Gemini Saved Info"]
  C -->|"1-Click Format"| G["MEMORY.md / .brain.json"]
```

## Why MemBridge?

| Feature | One-off Scripts | Vector DB / MCP Servers | **MemBridge** |
|---|---|---|---|
| Non-technical UI (Zero setup) | No | No (needs Docker/DB) | **Yes (Web Studio + Extension)** |
| Works across *all* major AIs | Usually 1 -> 1 | Coding tools only | **N-to-N (ChatGPT, Claude, Gemini, DeepSeek, Agents)** |
| Compresses noisy chat logs | Raw dumps | Raw chunks | **Smart signal extraction & token meter** |
| Auto-redacts API keys & emails | No | No | **Built-in secret masker** |
| 100% local & zero dependencies | Mixed | Often needs API keys | **Yes — 0 npm dependencies** |

---

## Quick Start (3 Ways to Use)

### 1. Zero-Install Web Studio (Easiest for Everyone)
Double-click `index.html` directly in your browser **or** start the local server:

```bash
npm start
# Opens at http://127.0.0.1:4321
```

1. **Import:** Drop `conversations.json` (from ChatGPT/Claude), `.brain.json`, or paste the built-in **10-Second Quick-Extract Prompt** output from any AI chat.
2. **Curate:** Toggle, edit, recategorize, and auto-mask accidental secrets (`sk-...`, `ghp_...`, emails).
3. **Teleport:** Pick **Claude**, **ChatGPT**, **Gemini**, **DeepSeek / Grok**, **`MEMORY.md`**, or **`.brain.json`** and click **Copy**.

### 2. Chrome / Edge Browser Extension (In-Tab Teleport)
1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Visit ChatGPT, Claude, Gemini, or DeepSeek -> click **Extract Brain** -> switch to another AI -> click **Inject Into Chat**.

### 3. Developer CLI
```bash
# Try the built-in demo
node bin/cli.js demo --to claude

# Convert a ChatGPT export into a Cursor / Antigravity MEMORY.md
node bin/cli.js conversations.json --to markdown --out MEMORY.md

# Convert a .brain.json backup for Gemini
node bin/cli.js membridge.brain.json --to gemini
```

---

## Open `.brain.json` Format
```json
{
  "version": "1.0",
  "format": "membridge.brain.json",
  "exportedAt": "2026-11-18T00:00:00.000Z",
  "memories": [
    {
      "id": "mem_0_1a2b",
      "category": "identity",
      "text": "Full-stack developer building local-first AI tools",
      "source": "chatgpt-json",
      "enabled": true
    }
  ]
}
```

## Run Tests
```bash
npm test
```

## License
MIT

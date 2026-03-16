# 🧠 AI Code Analyser

A web-based developer tool that uses Claude AI to explain, refactor, test, and security-audit your source code — in real time.

---

## 🚀 Features

### 🔍 Code Analysis
- Instant summaries, step-by-step breakdowns, and complexity analysis
- Inputs/outputs and side effect detection
- Beginner and experienced modes

### 🛠️ Refactoring
- Clean code suggestions with rationale
- Preserves original behaviour while improving readability

### 🧪 Unit Test Generation
- Auto-generates tests with framework detection
- Covers happy paths, edge cases, and error handling

### 🔐 Security Audit
- OWASP-based vulnerability detection
- Risk rating (critical → none) with a patched code output

### ⚡ Streaming Mode
- Token-by-token streaming on all endpoints via SSE
- Feels instant even for large codebases

---

## 🧰 Tech Stack

- **Frontend:** HTML, CSS, Vanilla JS
- **Backend:** Node.js + Express
- **AI:** Claude API (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk`
- **Rate Limiting:** 20 req/min, 100 req/day per IP

---

## Screenshots

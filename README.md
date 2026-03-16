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

<img width="1420" height="603" alt="Screenshot 2025-11-14 at 1 29 56 PM" src="https://github.com/user-attachments/assets/9e2c3e37-6273-4a4f-96d6-715cefaed1d3" />
<img width="906" height="621" alt="Screenshot 2025-11-10 at 6 25 19 PM" src="https://github.com/user-attachments/assets/fc1c689e-d409-4f04-9c2b-9f4b2c5ea7ef" />
<img width="528" height="375" alt="Screenshot 2025-11-10 at 6 25 10 PM" src="https://github.com/user-attachments/assets/d52da72e-3ba7-4579-b37f-6719512472b4" />

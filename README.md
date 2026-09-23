# AI Code Analyser

A web-based developer tool that explains, refactors, tests, and security-audits source code in real time.

### Project link: [ai-code-analyser.onrender.com](https://ai-code-analyser.onrender.com/)

Refresh 2–3 times if it's asleep (hosted on Render free tier).

## Features

### Code Analysis
- Instant summaries, step-by-step breakdowns, and complexity analysis
- Inputs/outputs and side effect detection
- Beginner and experienced modes

### Refactoring
- Clean code suggestions with rationale
- Preserves original behaviour while improving readability

### Unit Test Generation
- Auto-generates tests with framework detection
- Covers happy paths, edge cases, and error handling

### Security Audit
- OWASP-based vulnerability detection
- Risk rating (critical → none) with a patched code output

### Streaming Mode
- Token-by-token streaming on all endpoints via SSE

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Node.js + Express |
| AI | Claude Sonnet 5, with Gemini 2.5 Flash as fallback |
| Rate limiting | 20 req/min, 100 req/day per IP |

`claude-sonnet-4-20250514` was retired on 15 June 2026, so the app now defaults to `claude-sonnet-5`.

## Getting Started

```bash
git clone https://github.com/your-username/ai-code-analyser.git
cd ai-code-analyser
npm install
cp .env.example .env
npm start
```

Add at least one API key to `.env`:

```
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_WORKSPACE_ID=wrkspc_your_workspace_id_here
```

Identity-linked Claude keys that are not scoped to one workspace also need `ANTHROPIC_WORKSPACE_ID` from Claude Console → Settings → Workspaces.

If Claude is unavailable, use Gemini instead:

```
GEMINI_API_KEY=your_gemini_key_here
```

Optional overrides:

```
CLAUDE_MODEL=claude-sonnet-5
GEMINI_MODEL=gemini-2.5-flash
AI_PROVIDER=claude
```

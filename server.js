// server.js — AI Code Explainer
//   • Claude Sonnet 5 (retired claude-sonnet-4-20250514 no longer works)
//   • Gemini fallback when ANTHROPIC_API_KEY is missing
//   • tool_use / JSON schema → structured output
//   • streaming → token-by-token SSE on /stream endpoints
//   • rate limiting → 20 req/min, 100 req/day per IP

require("dotenv").config();
const express = require("express");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function resolveProvider() {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  if (forced === "claude" || forced === "gemini") return forced;
  if (ANTHROPIC_API_KEY) return "claude";
  if (GEMINI_API_KEY) return "gemini";
  return "";
}

const PROVIDER = resolveProvider();
const MODEL = PROVIDER === "gemini" ? GEMINI_MODEL : CLAUDE_MODEL;

const claude = ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      defaultHeaders: ANTHROPIC_WORKSPACE_ID
        ? { "anthropic-workspace-id": ANTHROPIC_WORKSPACE_ID }
        : undefined,
    })
  : null;
const gemini = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : null;

if (!PROVIDER) {
  console.error(
    "No API key found. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to a .env file."
  );
} else {
  console.log(`AI provider → ${PROVIDER} (${MODEL})`);
  if (PROVIDER === "claude" && !ANTHROPIC_WORKSPACE_ID) {
    console.warn(
      "ANTHROPIC_WORKSPACE_ID is not set. Identity-linked Claude keys need this header."
    );
  }
}

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Rate limiter (sliding window, in-memory) ─────────────────────────────────
const RATE_LIMIT_MINUTE = parseInt(process.env.RATE_LIMIT_MINUTE || "20", 10);
const RATE_LIMIT_DAY = parseInt(process.env.RATE_LIMIT_DAY || "100", 10);
const minuteStore = {};
const dayStore = {};

function getRateCount(store, ip, windowMs) {
  const now = Date.now();
  if (!store[ip]) store[ip] = [];
  store[ip] = store[ip].filter((t) => now - t < windowMs);
  return store[ip].length;
}

function recordHit(store, ip) {
  if (!store[ip]) store[ip] = [];
  store[ip].push(Date.now());
}

function rateLimiter(req, res, next) {
  const ip = req.ip || "unknown";
  const minuteCount = getRateCount(minuteStore, ip, 60_000);
  if (minuteCount >= RATE_LIMIT_MINUTE) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      detail: `Max ${RATE_LIMIT_MINUTE} requests per minute.`,
      retry_after_seconds: 60,
    });
  }
  const dayCount = getRateCount(dayStore, ip, 86_400_000);
  if (dayCount >= RATE_LIMIT_DAY) {
    return res.status(429).json({
      error: "Daily limit exceeded",
      detail: `Max ${RATE_LIMIT_DAY} requests per day.`,
      retry_after_seconds: 86400,
    });
  }
  recordHit(minuteStore, ip);
  recordHit(dayStore, ip);
  res.setHeader("X-RateLimit-Limit-Minute", RATE_LIMIT_MINUTE);
  res.setHeader("X-RateLimit-Remaining-Minute", RATE_LIMIT_MINUTE - minuteCount - 1);
  res.setHeader("X-RateLimit-Limit-Day", RATE_LIMIT_DAY);
  res.setHeader("X-RateLimit-Remaining-Day", RATE_LIMIT_DAY - dayCount - 1);
  next();
}

function requireProvider(req, res, next) {
  if (!PROVIDER) {
    return res.status(503).json({
      error: "AI provider is not configured",
      detail:
        "Add ANTHROPIC_API_KEY or GEMINI_API_KEY to a .env file in the project root, then restart the server.",
    });
  }
  if (PROVIDER === "claude" && !claude) {
    return res.status(503).json({
      error: "Claude is selected but ANTHROPIC_API_KEY is missing",
      detail: "Set ANTHROPIC_API_KEY or switch AI_PROVIDER=gemini.",
    });
  }
  if (PROVIDER === "gemini" && !gemini) {
    return res.status(503).json({
      error: "Gemini is selected but GEMINI_API_KEY is missing",
      detail: "Set GEMINI_API_KEY or switch AI_PROVIDER=claude.",
    });
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function modeInstructions(mode) {
  return mode === "beginner"
    ? "The user is a beginner. Use simple, friendly language. Add comments and error handling in code."
    : "The user is experienced. Be concise and technical. Use idiomatic patterns.";
}

function buildCodeContext(code, language, question) {
  const parts = [`Language: ${language || "auto-detect"}`];
  if (question) parts.push(`User question: ${question}`);
  parts.push("```\n" + code + "\n```");
  return parts.join("\n\n");
}

function formatAiError(err) {
  const message = err.message || String(err);
  if (
    message.includes("anthropic-workspace-id") ||
    message.includes("not scoped to a workspace")
  ) {
    return "This Claude API key is not scoped to a workspace. Add ANTHROPIC_WORKSPACE_ID to .env from Claude Console → Settings → Workspaces, or create a workspace-scoped key.";
  }
  return message;
}

function parseJsonPayload(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model returned invalid JSON.");
  }
}

async function callClaudeStructured(systemPrompt, userMessage, toolName, toolSchema) {
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    tools: [
      {
        name: toolName,
        description: `Return structured output for: ${toolName}`,
        input_schema: toolSchema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: userMessage }],
  });
  for (const block of response.content) {
    if (block.type === "tool_use") return block.input;
  }
  throw new Error("Claude returned no structured output.");
}

async function callGeminiStructured(systemPrompt, userMessage, toolName, toolSchema) {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      `${systemPrompt}\nReturn only valid JSON that matches the provided schema. Do not wrap it in markdown.`,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });
  const result = await model.generateContent(
    `${userMessage}\n\nRespond using this JSON schema for ${toolName}:\n${JSON.stringify(toolSchema)}`
  );
  return parseJsonPayload(result.response.text());
}

async function callStructured(systemPrompt, userMessage, toolName, toolSchema) {
  if (PROVIDER === "gemini") {
    return callGeminiStructured(systemPrompt, userMessage, toolName, toolSchema);
  }
  return callClaudeStructured(systemPrompt, userMessage, toolName, toolSchema);
}

async function streamClaude(systemPrompt, userMessage, res) {
  const stream = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    stream: true,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`);
    }
  }
}

async function streamGemini(systemPrompt, userMessage, res) {
  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0 },
  });
  const result = await model.generateContentStream(userMessage);
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  }
}

async function streamResponse(systemPrompt, userMessage, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    if (PROVIDER === "gemini") {
      await streamGemini(systemPrompt, userMessage, res);
    } else {
      await streamClaude(systemPrompt, userMessage, res);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("❌ stream:", err.message);
    res.write(`data: ${JSON.stringify({ error: formatAiError(err) })}\n\n`);
    res.end();
  }
}

// ─── /api/analyze ─────────────────────────────────────────────────────────────
app.post("/api/analyze", rateLimiter, requireProvider, async (req, res) => {
  const { mode, code, question, language } = req.body;
  try {
    const result = await callStructured(
      `You are an expert code explainer. ${modeInstructions(mode)}`,
      `Analyze this code:\n\n${buildCodeContext(code, language, question)}`,
      "analyze_code",
      {
        type: "object",
        properties: {
          summary: { type: "string" },
          time_complexity: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          improvements: { type: "array", items: { type: "string" } },
          caution: { type: "string" },
          inputs_outputs: {
            type: "object",
            properties: {
              inputs: { type: "string" },
              outputs: { type: "string" },
              side_effects: { type: "string" },
            },
            required: ["inputs", "outputs", "side_effects"],
          },
        },
        required: [
          "summary",
          "time_complexity",
          "steps",
          "improvements",
          "caution",
          "inputs_outputs",
        ],
      }
    );
    res.json(result);
  } catch (err) {
    console.error("❌ /api/analyze:", err.message);
    res.status(500).json({ error: "Analysis failed", detail: formatAiError(err) });
  }
});

app.post("/api/analyze/stream", rateLimiter, requireProvider, async (req, res) => {
  const { mode, code, question, language } = req.body;
  await streamResponse(
    `You are an expert code explainer. ${modeInstructions(mode)} Walk through the code section by section.`,
    `Explain this code step by step:\n\n${buildCodeContext(code, language, question)}`,
    res
  );
});

// ─── /api/refactor ────────────────────────────────────────────────────────────
app.post("/api/refactor", rateLimiter, requireProvider, async (req, res) => {
  const { mode, code, language } = req.body;
  try {
    const result = await callStructured(
      `You are a senior software engineer specialising in clean code. ${modeInstructions(mode)} Never change observable behaviour.`,
      `Refactor this code:\n\n${buildCodeContext(code, language)}`,
      "refactor_code",
      {
        type: "object",
        properties: {
          refactored_code: { type: "string" },
          rationale: { type: "array", items: { type: "string" } },
        },
        required: ["refactored_code", "rationale"],
      }
    );

    result.refactored_code = result.refactored_code
      ?.replace(/\\n/g, "\n")
      .replace(/\\t/g, "  ")
      .trim();

    res.json(result);
  } catch (err) {
    console.error("❌ /api/refactor:", err.message);
    res.status(500).json({ error: "Refactor failed", detail: formatAiError(err) });
  }
});

app.post("/api/refactor/stream", rateLimiter, requireProvider, async (req, res) => {
  const { mode, code, language } = req.body;
  await streamResponse(
    `You are a senior software engineer. ${modeInstructions(mode)} Explain each refactoring decision.`,
    `Refactor this code, explaining each change:\n\n${buildCodeContext(code, language)}`,
    res
  );
});

// ─── /api/tests ───────────────────────────────────────────────────────────────
app.post("/api/tests", rateLimiter, requireProvider, async (req, res) => {
  const { mode, code, language } = req.body;
  try {
    const result = await callStructured(
      `You are a TDD expert. Generate comprehensive tests. ${modeInstructions(mode)} Cover happy paths, edge cases, and errors.`,
      `Generate unit tests:\n\n${buildCodeContext(code, language)}`,
      "generate_tests",
      {
        type: "object",
        properties: {
          test_code: { type: "string" },
          framework: { type: "string" },
          notes: { type: "array", items: { type: "string" } },
        },
        required: ["test_code", "framework", "notes"],
      }
    );
    result.test_code = result.test_code?.replace(/\\n/g, "\n").trim();
    res.json(result);
  } catch (err) {
    console.error("❌ /api/tests:", err.message);
    res.status(500).json({ error: "Test generation failed", detail: formatAiError(err) });
  }
});

app.post("/api/tests/stream", rateLimiter, requireProvider, async (req, res) => {
  const { mode, code, language } = req.body;
  await streamResponse(
    `You are a TDD expert. ${modeInstructions(mode)} Think aloud about what needs testing, then write the tests.`,
    `Generate unit tests:\n\n${buildCodeContext(code, language)}`,
    res
  );
});

// ─── /api/security ────────────────────────────────────────────────────────────
app.post("/api/security", rateLimiter, requireProvider, async (req, res) => {
  const { code, language } = req.body;
  try {
    const result = await callStructured(
      "You are an application security engineer and OWASP expert. Identify all vulnerabilities and return a fully patched version.",
      `Audit this code for security issues:\n\n${buildCodeContext(code, language)}`,
      "security_audit",
      {
        type: "object",
        properties: {
          overall_risk: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "none"],
          },
          summary: { type: "string" },
          vulnerabilities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                severity: { type: "string" },
                issue: { type: "string" },
                fix: { type: "string" },
              },
              required: ["title", "severity", "issue", "fix"],
            },
          },
          secure_code: { type: "string" },
        },
        required: ["overall_risk", "summary", "vulnerabilities", "secure_code"],
      }
    );
    result.secure_code = result.secure_code?.replace(/\\n/g, "\n").trim();
    res.json(result);
  } catch (err) {
    console.error("❌ /api/security:", err.message);
    res.status(500).json({ error: "Security audit failed", detail: formatAiError(err) });
  }
});

// ─── /health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: PROVIDER ? "ok" : "unconfigured",
    provider: PROVIDER || null,
    model: PROVIDER ? MODEL : null,
    configured: Boolean(PROVIDER),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));

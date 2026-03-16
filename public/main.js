// main.js — AI Code Explainer v2
// Upgrades over v1:
//   • Streaming mode (SSE) with typewriter animation for all actions
//   • Diff view for refactor (side-by-side per-change comparison)
//   • Security tab (new)
//   • Rate limit indicator
//   • Language auto-sent to server on all requests

// ─── Elements ─────────────────────────────────────────────────────────────────
const tabExplainBtn  = document.getElementById("tabExplainBtn");
const tabRefactorBtn = document.getElementById("tabRefactorBtn");
const tabTestsBtn    = document.getElementById("tabTestsBtn");
const tabSecurityBtn = document.getElementById("tabSecurityBtn");

const tabExplain  = document.getElementById("tab-explain");
const tabRefactor = document.getElementById("tab-refactor");
const tabTests    = document.getElementById("tab-tests");
const tabSecurity = document.getElementById("tab-security");

const analyzeBtn  = document.getElementById("analyzeBtn");
const refactorBtn = document.getElementById("refactorBtn");
const testsBtn    = document.getElementById("testsBtn");
const securityBtn = document.getElementById("securityBtn");
const clearBtn    = document.getElementById("clearBtn");

const streamToggle = document.getElementById("streamToggle");
const modeSelect   = document.getElementById("modeSelect");
const langSelect   = document.getElementById("langSelect");

const currentModeText    = document.getElementById("currentModeText");
const currentModeDesc    = document.getElementById("currentModeDesc");
const inputsOutputsSection = document.getElementById("inputsOutputsSection");
const loadingEl          = document.getElementById("loading");
const rateLimitBar       = document.getElementById("rateLimitBar");

// Explain outputs
const respSummary      = document.getElementById("respSummary");
const respInputsOutputs = document.getElementById("respInputsOutputs");
const respSteps        = document.getElementById("respSteps");
const respComplexity   = document.getElementById("respComplexity");
const respImprovements = document.getElementById("respImprovements");
const respCaution      = document.getElementById("respCaution");
const streamOutput     = document.getElementById("streamOutput");

// Refactor outputs
const refactorOutputBox = document.getElementById("refactorOutputBox");
const refactorWhy       = document.getElementById("refactorWhy");
const diffContainer     = document.getElementById("diffContainer");
const copyRefactorBtn   = document.getElementById("copyRefactorBtn");

// Test outputs
const testOutputBox = document.getElementById("testOutputBox");
const testNotes     = document.getElementById("testNotes");

// Security outputs
const securityRisk    = document.getElementById("securityRisk");
const securitySummary = document.getElementById("securitySummary");
const securityList    = document.getElementById("securityList");
const secureCodeBox   = document.getElementById("secureCodeBox");

// ─── Tab handler ──────────────────────────────────────────────────────────────
function showTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).classList.remove("hidden");
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add("active");
}

tabExplainBtn .addEventListener("click", () => showTab("tab-explain"));
tabRefactorBtn.addEventListener("click", () => showTab("tab-refactor"));
tabTestsBtn   .addEventListener("click", () => showTab("tab-tests"));
tabSecurityBtn.addEventListener("click", () => showTab("tab-security"));

// ─── Mode switch ──────────────────────────────────────────────────────────────
modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value;
  if (mode === "beginner") {
    document.body.classList.add("beginner");
    currentModeText.textContent = "Beginner 👶";
    currentModeDesc.textContent = "Explanations will be slow, friendly and include inputs/outputs.";
    inputsOutputsSection.style.display = "block";
  } else {
    document.body.classList.remove("beginner");
    currentModeText.textContent = "Pro 🚀";
    currentModeDesc.textContent = "Explanations will be concise and focus on complexity and improvements.";
    inputsOutputsSection.style.display = "none";
  }
});

// ─── Loading ──────────────────────────────────────────────────────────────────
function setLoading(isLoading) {
  loadingEl.classList.toggle("hidden", !isLoading);
  [analyzeBtn, refactorBtn, testsBtn, securityBtn].forEach(b => b.disabled = isLoading);
}

// ─── Rate limit display ───────────────────────────────────────────────────────
function updateRateLimitBar(headers) {
  const remaining = headers.get("X-RateLimit-Remaining-Day");
  const limit     = headers.get("X-RateLimit-Limit-Day");
  if (remaining !== null && limit !== null && rateLimitBar) {
    rateLimitBar.textContent = `Daily requests: ${limit - remaining}/${limit} used`;
  }
}

// ─── Streaming helper ─────────────────────────────────────────────────────────
// Calls a /stream endpoint and writes tokens into `targetEl` one by one.
async function runStream(endpoint, body, targetEl) {
  targetEl.textContent = "";
  targetEl.classList.remove("hidden");

  const res = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body)
  });

  if (!res.ok) {
    targetEl.textContent = "⚠ Stream error: " + res.statusText;
    return;
  }

  updateRateLimitBar(res.headers);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      try {
        const { delta, error } = JSON.parse(payload);
        if (error) { targetEl.textContent += "\n⚠ " + error; return; }
        if (delta)  targetEl.textContent += delta;
      } catch {}
    }
  }
}

// ─── Diff view ────────────────────────────────────────────────────────────────
// Builds a simple line-diff display for each change returned by /api/refactor
function renderDiff(changes) {
  if (!diffContainer) return;
  if (!changes || changes.length === 0) {
    diffContainer.classList.add("hidden");
    return;
  }

  diffContainer.innerHTML = "";
  diffContainer.classList.remove("hidden");

  const title = document.createElement("div");
  title.className = "resp-title";
  title.textContent = `Changes (${changes.length})`;
  diffContainer.appendChild(title);

  changes.forEach((change, i) => {
    const card = document.createElement("div");
    card.className = "diff-card";

    const reasonEl = document.createElement("div");
    reasonEl.className = "diff-reason";
    reasonEl.textContent = `${i + 1}. ${change.reason}`;
    card.appendChild(reasonEl);

    const cols = document.createElement("div");
    cols.className = "diff-cols";

    const beforeCol = document.createElement("div");
    beforeCol.className = "diff-col diff-before";
    const beforeLabel = document.createElement("div");
    beforeLabel.className = "diff-label";
    beforeLabel.textContent = "Before";
    const beforeCode = document.createElement("pre");
    beforeCode.textContent = change.original || "";
    beforeCol.appendChild(beforeLabel);
    beforeCol.appendChild(beforeCode);

    const afterCol = document.createElement("div");
    afterCol.className = "diff-col diff-after";
    const afterLabel = document.createElement("div");
    afterLabel.className = "diff-label";
    afterLabel.textContent = "After";
    const afterCode = document.createElement("pre");
    afterCode.textContent = change.refactored || "";
    afterCol.appendChild(afterLabel);
    afterCol.appendChild(afterCode);

    cols.appendChild(beforeCol);
    cols.appendChild(afterCol);
    card.appendChild(cols);
    diffContainer.appendChild(card);
  });
}

// ─── Analyze ──────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", async () => {
  const mode     = modeSelect.value;
  const language = langSelect.value;
  const code     = document.getElementById("codeInput").value.trim();
  const question = document.getElementById("questionInput").value.trim();

  if (!code) return;
  setLoading(true);
  showTab("tab-explain");

  const useStream = streamToggle?.checked;

  if (useStream) {
    // Clear structured fields, show stream box
    [respSummary, respSteps, respComplexity, respImprovements, respCaution].forEach(el => el.textContent = "");
    inputsOutputsSection.style.display = "none";
    await runStream("/api/analyze/stream", { mode, code, question, language }, streamOutput);
    setLoading(false);
    return;
  }

  streamOutput.classList.add("hidden");

  try {
    const res  = await fetch("/api/analyze", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mode, code, question, language })
    });
    updateRateLimitBar(res.headers);
    const data = await res.json();

    if (!res.ok) {
      respSummary.textContent = "⚠ " + (data.error || "Request failed");
      return;
    }

    respSummary.textContent    = data.summary        || "";
    respComplexity.textContent = data.time_complexity || "";
    respCaution.textContent    = data.caution         || "";
    respSteps.textContent      = Array.isArray(data.steps)
      ? data.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
    respImprovements.textContent = Array.isArray(data.improvements)
      ? data.improvements.map(s => `• ${s}`).join("\n") : "";

    if (mode === "beginner" && data.inputs_outputs) {
      inputsOutputsSection.style.display = "block";
      const io = data.inputs_outputs;
      respInputsOutputs.textContent =
        `Inputs: ${io.inputs}\nOutputs: ${io.outputs}\nSide effects: ${io.side_effects}`;
    } else {
      inputsOutputsSection.style.display = "none";
    }
  } catch (err) {
    respSummary.textContent = "⚠ Network error: " + err.message;
  } finally {
    setLoading(false);
  }
});

// ─── Refactor ─────────────────────────────────────────────────────────────────
refactorBtn.addEventListener("click", async () => {
  const mode     = modeSelect.value;
  const language = langSelect.value;
  const code     = document.getElementById("codeInput").value.trim();

  if (!code) return;
  setLoading(true);
  showTab("tab-refactor");

  const useStream = streamToggle?.checked;

  if (useStream) {
    refactorOutputBox.textContent = "";
    diffContainer.classList.add("hidden");
    const streamEl = document.getElementById("refactorStreamOutput");
    await runStream("/api/refactor/stream", { mode, code, language }, streamEl);
    setLoading(false);
    return;
  }

  try {
    const res  = await fetch("/api/refactor", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mode, code, language })
    });
    updateRateLimitBar(res.headers);
    const data = await res.json();

    if (!res.ok) {
      refactorOutputBox.textContent = "⚠ " + (data.error || "Request failed");
      return;
    }

    refactorOutputBox.textContent = data.refactored_code || "";
    refactorWhy.textContent = Array.isArray(data.rationale)
      ? data.rationale.map(r => `• ${r}`).join("\n") : "";

    renderDiff(data.changes);
  } catch (err) {
    refactorOutputBox.textContent = "⚠ Network error: " + err.message;
  } finally {
    setLoading(false);
  }
});

copyRefactorBtn?.addEventListener("click", async () => {
  const text = refactorOutputBox.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyRefactorBtn.textContent = "Copied!";
    setTimeout(() => copyRefactorBtn.textContent = "Copy", 2000);
  } catch (e) { console.error(e); }
});

// ─── Tests ────────────────────────────────────────────────────────────────────
testsBtn.addEventListener("click", async () => {
  const mode     = modeSelect.value;
  const language = langSelect.value;
  const code     = document.getElementById("codeInput").value.trim();

  if (!code) return;
  setLoading(true);
  showTab("tab-tests");

  const useStream = streamToggle?.checked;

  if (useStream) {
    testOutputBox.textContent = "";
    const streamEl = document.getElementById("testsStreamOutput");
    await runStream("/api/tests/stream", { mode, code, language }, streamEl);
    setLoading(false);
    return;
  }

  try {
    const res  = await fetch("/api/tests", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mode, code, language })
    });
    updateRateLimitBar(res.headers);
    const data = await res.json();

    if (!res.ok) {
      testOutputBox.textContent = "⚠ " + (data.error || "Request failed");
      return;
    }

    testOutputBox.textContent = data.test_code || "";
    testNotes.textContent = Array.isArray(data.notes)
      ? data.notes.map(n => `• ${n}`).join("\n") : "";
  } catch (err) {
    testOutputBox.textContent = "⚠ Network error: " + err.message;
  } finally {
    setLoading(false);
  }
});

// ─── Security ─────────────────────────────────────────────────────────────────
securityBtn?.addEventListener("click", async () => {
  const language = langSelect.value;
  const code     = document.getElementById("codeInput").value.trim();

  if (!code) return;
  setLoading(true);
  showTab("tab-security");

  try {
    const res  = await fetch("/api/security", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, language })
    });
    updateRateLimitBar(res.headers);
    const data = await res.json();

    if (!res.ok) {
      securitySummary.textContent = "⚠ " + (data.error || "Request failed");
      return;
    }

    // Risk badge
    if (securityRisk) {
      securityRisk.textContent  = (data.overall_risk || "unknown").toUpperCase();
      securityRisk.className    = `risk-badge risk-${data.overall_risk || "low"}`;
    }
    if (securitySummary) securitySummary.textContent = data.summary || "";
    if (secureCodeBox)   secureCodeBox.textContent   = data.secure_code || "";

    // Vulnerability list
    if (securityList && Array.isArray(data.vulnerabilities)) {
      securityList.innerHTML = "";
      data.vulnerabilities.forEach(v => {
        const item = document.createElement("div");
        item.className = `vuln-item vuln-${v.severity || "low"}`;
        item.innerHTML = `
          <div class="vuln-title">[${(v.severity || "").toUpperCase()}] ${v.title}</div>
          <div class="vuln-issue">${v.issue}</div>
          <div class="vuln-fix"><strong>Fix:</strong> ${v.fix}</div>`;
        securityList.appendChild(item);
      });
    }
  } catch (err) {
    if (securitySummary) securitySummary.textContent = "⚠ Network error: " + err.message;
  } finally {
    setLoading(false);
  }
});

// ─── Clear ────────────────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  document.getElementById("codeInput").value  = "";
  document.getElementById("questionInput").value = "";
});

// ─── Init ─────────────────────────────────────────────────────────────────────
showTab("tab-explain");

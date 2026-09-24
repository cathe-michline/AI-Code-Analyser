# Playwright Beginner Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JavaScript Playwright suite that tests this app’s UI locally, with comments that teach each step, and one mocked Analyze flow.

**Architecture:** Playwright Test starts `node server.js`, hits `http://localhost:3000`, and uses Chromium only. UI tests never call Claude. Analyze is mocked with `page.route`.

**Tech Stack:** Node.js, `@playwright/test`, Chromium, existing Express app.

## Global Constraints

- JavaScript only (CommonJS `require`, matching `server.js`)
- Chromium only
- Tests live in `tests/*.spec.js`
- Do not call the live Claude API
- Do not add TypeScript, Page Objects, or GitHub Actions

---

### Task 1: Playwright config + first UI tests

**Files:**
- Create: `playwright.config.js`
- Create: `tests/ui.spec.js`
- Modify: `package.json` scripts
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright and Chromium**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add `playwright.config.js`**

```js
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node server.js",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

- [ ] **Step 3: Write `tests/ui.spec.js`** with heading, tabs, mode, clear, and empty Analyze.

- [ ] **Step 4: Run**

```bash
npx playwright test tests/ui.spec.js
```

Expected: all UI tests pass.

- [ ] **Step 5: Commit only if the user asks**

---

### Task 2: Mocked Analyze flow

**Files:**
- Create: `tests/analyze.spec.js`

- [ ] **Step 1: Write analyze.spec.js** that routes `**/api/analyze`, fills code, clicks Analyze, asserts `#respSummary`.

- [ ] **Step 2: Run**

```bash
npx playwright test tests/analyze.spec.js
```

Expected: pass without calling Claude.

---

### Task 3: npm scripts

**Files:**
- Modify: `package.json`

```json
"test": "playwright test",
"test:headed": "playwright test --headed",
"test:ui": "playwright test --ui"
```

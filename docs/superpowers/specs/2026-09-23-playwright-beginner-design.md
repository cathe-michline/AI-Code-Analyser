# Playwright beginner suite for AI Code Analyser

Date: 2026-09-23

## Goal

Teach Playwright using this app. First suite: JavaScript tests against a local server, with a mocked Analyze call so Claude is not used.

## Layout

```
AI-Code-Analyser/
  playwright.config.js      # browsers, base URL, how to start the server
  tests/
    ui.spec.js              # clicks and tabs, no API
    analyze.spec.js         # paste code, mock /api/analyze, check Summary
  server.js
  public/
```

Create the test files under `tests/` at the project root, not inside `public/`. Playwright looks for `*.spec.js` there by default once `testDir` is set.

## Runtime

- Language: JavaScript
- Runner: `@playwright/test`
- Browser: Chromium only for the first lesson
- App: Playwright starts `node server.js` and uses `http://localhost:3000`
- Analyze: `page.route('**/api/analyze', ...)` returns fixed JSON
- Out of scope: live Claude, other API tabs, TypeScript, Page Objects, GitHub Actions

## Test cases

### ui.spec.js

- Heading is visible
- Tabs switch: Explanation, Refactored, Tests, Security
- Mode select updates Beginner / Pro label
- Clear empties `#codeInput`
- Analyze with empty code does not show loading

### analyze.spec.js

- Fill `#codeInput`
- Mock `POST /api/analyze`
- Click Analyze
- `#respSummary` shows mocked summary
- `#loading` is hidden afterward

## Commands

```bash
npx playwright test
npx playwright test --headed
```

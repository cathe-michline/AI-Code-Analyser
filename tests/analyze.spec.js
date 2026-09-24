const { test, expect } = require("@playwright/test");

test("GET /health returns JSON", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.ok()).toBeTruthy();
})

test("POST /api/analyze returns a summary", async ({ request }) => {
  test.setTimeout(45_000);

  const res = await request.post("/api/analyze", {
    data: {
      mode: "beginner",
      language: "python",
      code: "print(1 + 1)",
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("summary");
  expect(body.summary.length).toBeGreaterThan(0);
});

const sample = {
  mode: "beginner",
  language: "python",
  code: "print(1 + 1)",
};

test("POST /api/refactor returns refactored code", async ({ request }) => {
  test.setTimeout(45_000);

  const res = await request.post("/api/refactor", { data: sample });
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body).toHaveProperty("refactored_code");
  expect(body.refactored_code.length).toBeGreaterThan(0);
  expect(Array.isArray(body.rationale)).toBeTruthy();
});

test("POST /api/tests returns generated tests", async ({ request }) => {
  test.setTimeout(45_000);

  const res = await request.post("/api/tests", {
    data: {
      mode: "beginner",
      language: "python",
      code: "def add(a, b):\n    return a + b",
    },
  });
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body).toHaveProperty("test_code");
  expect(body.test_code.length).toBeGreaterThan(0);
  expect(body).toHaveProperty("framework");
});

test("POST /api/security returns an audit", async ({ request }) => {
  test.setTimeout(45_000);

  const res = await request.post("/api/security", {
    data: { language: "python", code: "print(1 + 1)" },
  });
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body).toHaveProperty("overall_risk");
  expect(body).toHaveProperty("summary");
  expect(Array.isArray(body.vulnerabilities)).toBeTruthy();
  expect(body).toHaveProperty("secure_code");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers.js";

test("teacher personal AI credentials are encrypted, isolated, and never returned", async () => {
  const t = setup(),
    a = await t.teacher("a"),
    b = await t.teacher("b"),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code),
    token = "test-personal-token-1234567890";
  t.env.AI = { run: async () => ({ response: "공용 결과" }) };
  const saved = await t.req(
    "/teacher-ai",
    "PUT",
    {
      mode: "personal",
      accountId: "a".repeat(32),
      token,
      consent: true,
      dailyLimit: 3,
    },
    a.cookie,
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.configured, true);
  assert.equal(JSON.stringify(saved.data).includes(token), false);
  const row = t.db.prepare("SELECT * FROM teacher_ai").get();
  assert.ok(row.token_cipher);
  assert.equal(row.token_cipher.includes(token), false);
  assert.equal((await t.req("/teacher-ai", "GET", {}, s.cookie)).status, 403);
  assert.equal(
    (await t.req("/teacher-ai", "GET", {}, b.cookie)).data.configured,
    false,
  );
  assert.equal(
    (
      await t.req(
        "/teacher-ai",
        "PUT",
        {
          mode: "personal",
          accountId: "b".repeat(32),
          token: "",
          consent: true,
        },
        a.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (await t.req("/teacher-ai", "DELETE", {}, a.cookie)).data.mode,
    "shared",
  );
  assert.equal(t.db.prepare("SELECT count(*) n FROM teacher_ai").get().n, 0);
  t.db.close();
});

test("personal classroom routes analysis to its teacher account and enforces its daily limit", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code),
    accountId = "a".repeat(32),
    token = "test-personal-token-1234567890";
  await t.req(
    "/teacher-ai",
    "PUT",
    { mode: "personal", accountId, token, consent: true, dailyLimit: 1 },
    a.cookie,
  );
  await t.req("/work", "PUT", { career: "건축" }, s.cookie);
  const original = globalThis.fetch;
  let sent,
    count = 0;
  globalThis.fetch = async (url, init) => {
    count++;
    assert.equal(
      url,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/qwen/qwen3.8-27b`,
    );
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    sent = JSON.parse(init.body);
    return Response.json({
      success: true,
      result: {
        choices: [
          { message: { content: "주제 후보 3개" }, finish_reason: "stop" },
        ],
      },
    });
  };
  try {
    assert.equal(
      (await t.req("/ai", "POST", { action: "topics" }, s.cookie)).status,
      200,
    );
    assert.match(sent.messages[1].content, /건축/);
    assert.equal(
      (await t.req("/ai", "POST", { action: "topics" }, s.cookie)).status,
      429,
    );
    assert.equal(count, 1);
    assert.equal(
      t.db.prepare("SELECT count(*) n FROM usage WHERE key='global-ai'").get()
        .n,
      0,
    );
  } finally {
    globalThis.fetch = original;
    t.db.close();
  }
});

test("personal provider failure never silently falls back to the shared provider", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  let sharedCalls = 0;
  t.env.AI = {
    run: async () => {
      sharedCalls++;
      return { response: "공용 결과" };
    },
  };
  await t.req(
    "/teacher-ai",
    "PUT",
    {
      mode: "personal",
      accountId: "a".repeat(32),
      token: "test-personal-token-1234567890",
      consent: true,
    },
    a.cookie,
  );
  await t.req("/work", "PUT", { career: "환경" }, s.cookie);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 403 });
  try {
    const r = await t.req("/ai", "POST", { action: "topics" }, s.cookie);
    assert.equal(r.status, 502);
    assert.match(r.data.error, /토큰/);
    assert.equal(sharedCalls, 0);
  } finally {
    globalThis.fetch = original;
    t.db.close();
  }
});

test("teacher disabling AI applies to students while writing remains available", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  let calls = 0;
  t.env.AI = {
    run: async () => {
      calls++;
      return { response: "결과" };
    },
  };
  await t.req("/teacher-ai", "PUT", { mode: "disabled" }, a.cookie);
  assert.equal((await t.req("/me", "GET", {}, s.cookie)).data.ai, false);
  assert.equal(
    (
      await t.req(
        "/work",
        "PUT",
        { career: "환경", draft: "직접 쓴 글" },
        s.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await t.req("/ai", "POST", { action: "topics" }, s.cookie)).status,
    503,
  );
  assert.equal(calls, 0);
  t.db.close();
});

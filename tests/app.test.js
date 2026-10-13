import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import worker from "../src/worker.js";
import { FEEDBACK_INSTRUCTIONS } from "../src/policy.js";
function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    fs.readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  function prepared(sql, args = []) {
    return {
      bind(...a) {
        return prepared(sql, a);
      },
      async first() {
        return db.prepare(sql).get(...args) || null;
      },
      async all() {
        return { results: db.prepare(sql).all(...args) };
      },
      async run() {
        return db.prepare(sql).run(...args);
      },
    };
  }
  const env = {
    DB: {
      prepare: prepared,
      async batch(statements) {
        db.exec("BEGIN");
        try {
          const r = await Promise.all(statements.map((s) => s.run()));
          db.exec("COMMIT");
          return r;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
    AI_ENABLED: "true",
    ASSETS: { fetch: () => new Response("assets") },
    AI_DAILY_LIMIT: "1000",
    CLASS_AI_DAILY_LIMIT: "150",
  };
  async function req(path, method = "GET", data = {}, cookie = "") {
    const r = await worker.fetch(
      new Request(`https://test.example/api${path}`, {
        method,
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: method === "GET" ? undefined : JSON.stringify(data),
      }),
      env,
    );
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function teacher(username = "teacher") {
    const t = await req("/auth/teacher-register", "POST", {
      username,
      password: "teacherpass123",
    });
    assert.equal(t.status, 200);
    return t;
  }
  async function classroom(cookie, title = "수업") {
    const c = await req("/classes", "POST", { title }, cookie);
    assert.equal(c.status, 200);
    await req(
      `/classes/${c.data.id}/material`,
      "PUT",
      {
        title: "공통 글",
        body: "지역의 발전과 환경을 함께 생각한다.",
        source: "교사 자료",
      },
      cookie,
    );
    return c.data;
  }
  async function student(code, nickname = "학생") {
    const s = await req("/auth/student", "POST", {
      code,
      nickname,
      password: "studentpass",
      register: true,
    });
    assert.equal(s.status, 200);
    return s;
  }
  return { db, env, req, teacher, classroom, student };
}
test("teacher classroom isolation and student draft privacy", async () => {
  const t = setup(),
    a = await t.teacher("a"),
    b = await t.teacher("b"),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code),
    s2 = await t.student(c.code, "다른학생");
  await t.req(
    "/work",
    "PUT",
    {
      draft: "나만의 비공개 초안",
      topic: "환경 질문",
      career: "환경",
      shareTopic: true,
      shareCareer: false,
    },
    s.cookie,
  );
  assert.equal(
    (await t.req(`/classes/${c.id}/students`, "GET", {}, b.cookie)).status,
    403,
  );
  const topics = await t.req("/topics", "GET", {}, s2.cookie);
  assert.equal(topics.data.topics[0].career, "관심 분야 비공개");
  assert.equal(JSON.stringify(topics.data).includes("비공개 초안"), false);
  const mine = await t.req("/work", "GET", {}, s2.cookie);
  assert.deepEqual(mine.data.data, {});
  assert.equal(
    (await t.req(`/classes/${c.id}/students`, "GET", {}, a.cookie)).data
      .students.length,
    2,
  );
  t.db.close();
});
test("a student cannot read another class posts or add comments across classrooms", async () => {
  const t = setup(),
    a = await t.teacher(),
    c1 = await t.classroom(a.cookie, "1반"),
    c2 = await t.classroom(a.cookie, "2반"),
    s1 = await t.student(c1.code),
    s2 = await t.student(c2.code);
  await t.req(
    "/work",
    "PUT",
    { title: "제목", final: "완성 글", reflection: "소감" },
    s1.cookie,
  );
  assert.equal((await t.req("/posts", "POST", {}, s1.cookie)).status, 200);
  const p = (await t.req("/posts", "GET", {}, s1.cookie)).data.posts[0];
  assert.equal(
    (await t.req("/posts", "GET", {}, s2.cookie)).data.posts.length,
    0,
  );
  assert.equal(
    (
      await t.req(
        "/comments",
        "POST",
        { postId: p.id, body: "침입 댓글" },
        s2.cookie,
      )
    ).status,
    404,
  );
  t.db.close();
});
test("hidden posts cannot be revealed by student republishing", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  await t.req(
    "/work",
    "PUT",
    { title: "제목", final: "글", reflection: "소감" },
    s.cookie,
  );
  await t.req("/posts", "POST", {}, s.cookie);
  const p = (await t.req("/posts", "GET", {}, s.cookie)).data.posts[0];
  await t.req(
    `/classes/${c.id}/moderate`,
    "POST",
    { type: "post", id: p.id, hidden: true },
    a.cookie,
  );
  assert.equal(
    (await t.req("/posts", "GET", {}, s.cookie)).data.posts.length,
    0,
  );
  assert.equal((await t.req("/posts", "POST", {}, s.cookie)).status, 403);
  t.db.close();
});
test("session reset invalidates student cookies and permits new password login", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  const students = await t.req(
    `/classes/${c.id}/students`,
    "GET",
    {},
    a.cookie,
  );
  const reset = await t.req(
    `/classes/${c.id}/reset`,
    "POST",
    { studentId: students.data.students[0].id },
    a.cookie,
  );
  assert.equal((await t.req("/work", "GET", {}, s.cookie)).status, 401);
  const login = await t.req("/auth/student", "POST", {
    code: c.code,
    nickname: "학생",
    password: reset.data.password,
  });
  assert.equal(login.status, 200);
  t.db.close();
});
test("closed classrooms retain records and disallow new activity", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  await t.req("/work", "PUT", { memo: "읽기 기록" }, s.cookie);
  await t.req(`/classes/${c.id}`, "PUT", { active: false }, a.cookie);
  assert.equal(
    (await t.req("/work", "PUT", { draft: "새 글" }, s.cookie)).status,
    403,
  );
  assert.equal(
    (await t.req("/work", "GET", {}, s.cookie)).data.data.memo,
    "읽기 기록",
  );
  assert.equal(
    (
      await t.req("/auth/student", "POST", {
        code: c.code,
        nickname: "신규",
        password: "password",
        register: true,
      })
    ).status,
    404,
  );
  t.db.close();
});
test("deleting a class cascades records and invalidates sessions", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  await t.req("/work", "PUT", { draft: "초안" }, s.cookie);
  assert.equal(
    (await t.req(`/classes/${c.id}`, "DELETE", {}, a.cookie)).status,
    200,
  );
  assert.equal(t.db.prepare("SELECT count(*) n FROM students").get().n, 0);
  assert.equal(t.db.prepare("SELECT count(*) n FROM work").get().n, 0);
  assert.equal((await t.req("/me", "GET", {}, s.cookie)).status, 401);
  t.db.close();
});
test("feedback requires confirmed student text and never silently simulates AI", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  await t.req("/work", "PUT", { draft: "초안" }, s.cookie);
  assert.equal(
    (await t.req("/ai", "POST", { action: "feedback" }, s.cookie)).status,
    400,
  );
  await t.req("/work", "PUT", { ocrConfirmed: true }, s.cookie);
  assert.equal(
    (await t.req("/ai", "POST", { action: "feedback" }, s.cookie)).status,
    503,
  );
  assert.match(FEEDBACK_INSTRUCTIONS, /대체 문장/);
  assert.match(FEEDBACK_INSTRUCTIONS, /수정 과제/);
  t.db.close();
});
test("actual AI request shape uses Responses and persists feedback snapshot", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  await t.req(
    "/work",
    "PUT",
    { draft: "학생이 직접 작성한 글", career: "건축", ocrConfirmed: true },
    s.cookie,
  );
  t.env.OPENAI_API_KEY = "test-key";
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    sent = JSON.parse(init.body);
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: "강점: 질문이 구체적입니다. 수정 과제: 근거를 확인하세요.",
            },
          ],
        },
      ],
    });
  };
  try {
    const r = await t.req("/ai", "POST", { action: "feedback" }, s.cookie);
    assert.equal(r.status, 200);
    assert.equal(sent.store, false);
    assert.match(sent.instructions, /전문가 관점/);
    const w = await t.req("/work", "GET", {}, s.cookie);
    assert.equal(w.data.feedback[0].draft, "학생이 직접 작성한 글");
  } finally {
    globalThis.fetch = original;
    t.db.close();
  }
});
test("CSRF requests fail and auth cookies are HttpOnly", async () => {
  const t = setup(),
    r = await worker.fetch(
      new Request("https://test.example/api/classes", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      t.env,
    );
  assert.equal(r.status, 403);
  const a = await t.teacher();
  const login = await worker.fetch(
    new Request("https://test.example/api/auth/teacher-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "teacher", password: "teacherpass123" }),
    }),
    t.env,
  );
  assert.match(login.headers.get("Set-Cookie"), /HttpOnly/);
  assert.match(login.headers.get("Set-Cookie"), /Secure/);
  assert.match(login.headers.get("Set-Cookie"), /SameSite=Strict/);
  assert.ok(a.data.recovery);
  t.db.close();
});
test("work validation strips unauthorized fields and rejects oversized text", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  await t.req(
    "/work",
    "PUT",
    { draft: "글", student_id: "other", shareTopic: "true" },
    s.cookie,
  );
  const w = await t.req("/work", "GET", {}, s.cookie);
  assert.deepEqual(w.data.data, { draft: "글", shareTopic: false });
  assert.equal(
    (await t.req("/work", "PUT", { draft: "x".repeat(15001) }, s.cookie))
      .status,
    400,
  );
  t.db.close();
});

test("AI disabled flag blocks transmission even when a provider is available", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  t.env.AI_ENABLED = "false";
  let calls = 0;
  t.env.AI = {
    run: async () => {
      calls++;
      return { response: "must not run" };
    },
  };
  await t.req("/work", "PUT", { draft: "초안", ocrConfirmed: true }, s.cookie);
  assert.equal(
    (await t.req("/ai", "POST", { action: "feedback" }, s.cookie)).status,
    503,
  );
  assert.equal((await t.req("/health")).data.ai, false);
  assert.equal(calls, 0);
  t.db.close();
});

test("Cloudflare binding maps photo inputs and returns text without a provider key", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code);
  let sent;
  t.env.AI = {
    run: async (model, input) => {
      sent = input;
      return {
        choices: [
          { message: { content: "사진 속 학생의 글" }, finish_reason: "stop" },
        ],
      };
    },
  };
  const image = "data:image/jpeg;base64,YQ==";
  const r = await t.req(
    "/ai",
    "POST",
    { action: "ocr", images: [image] },
    s.cookie,
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.text, "사진 속 학생의 글");
  assert.equal(sent.messages[1].content[1].image_url.url, image);
  assert.equal(sent.store, false);
  assert.equal(sent.chat_template_kwargs.enable_thinking, false);
  t.db.close();
});

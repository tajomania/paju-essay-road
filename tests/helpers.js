import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import worker from "../src/worker.js";
export function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    fs.readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    fs.readFileSync(
      new URL("../migrations/0002_teacher_ai.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    fs.readFileSync(
      new URL("../migrations/0003_teacher_ai_provider.sql", import.meta.url),
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
    AI_KEY_ENCRYPTION_SECRET: "test-only-encryption-secret-not-for-production",
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

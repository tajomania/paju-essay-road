import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLocalServer } from "../local/server.mjs";
import { setup } from "./helpers.js";
import { runGemini } from "../src/gemini.js";

test("local installation serves UI, persists classes, and keeps credentials out of public paths", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "paju-local-test-"));
  let app = createLocalServer({ dataDir, port: 0, host: "127.0.0.1" });
  await app.start();
  let origin = `http://127.0.0.1:${app.server.address().port}`,
    cookie;
  const request = async (p, method = "GET", body) => {
    const r = await fetch(origin + p, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie || "" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, data: await r.json() };
  };
  try {
    assert.equal((await fetch(origin)).status, 200);
    assert.equal((await fetch(origin + "/encryption.key")).status, 404);
    assert.equal((await request("/api/health")).data.local, true);
    assert.equal(
      (
        await request("/api/auth/teacher-register", "POST", {
          username: "localteacher",
          password: "teacherpass123",
        })
      ).status,
      200,
    );
    assert.equal((await request("/api/teacher-ai")).data.provider, "google");
    const c = (await request("/api/classes", "POST", { title: "로컬 수업" }))
      .data;
    const me = (await request("/api/me")).data;
    assert.equal(me.local, true);
    assert.ok(me.localBaseURL.endsWith(":" + app.server.address().port));
    assert.equal(me.classes[0].id, c.id);
    await new Promise((resolve) => app.server.close(resolve));
    app = createLocalServer({ dataDir, port: 0, host: "127.0.0.1" });
    await app.start();
    origin = `http://127.0.0.1:${app.server.address().port}`;
    assert.equal((await request("/api/me")).data.classes[0].title, "로컬 수업");
  } finally {
    if (app.server.listening)
      await new Promise((resolve) => app.server.close(resolve));
    const resolved = path.resolve(dataDir);
    if (
      !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith("paju-local-test-")
    )
      throw new Error("Unsafe cleanup");
    rmSync(resolved, { recursive: true, force: true });
  }
});

test("school Gemini works hosted and locally while remote local clients cannot change keys", async () => {
  const t = setup(),
    a = await t.teacher(),
    body = {
      mode: "personal",
      provider: "google",
      schoolEmail: "teacher@goedu.kr",
      token: "test-google-api-key-123456789",
      model: "gemini-3.5-flash-lite",
      consent: true,
    };
  assert.equal((await t.req("/teacher-ai", "PUT", body, a.cookie)).status, 200);
  t.env.LOCAL_MODE = true;
  t.env.LOCAL_IS_LOOPBACK = false;
  assert.equal((await t.req("/teacher-ai", "PUT", body, a.cookie)).status, 403);
  t.env.LOCAL_IS_LOOPBACK = true;
  const saved = await t.req("/teacher-ai", "PUT", body, a.cookie);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.provider, "google");
  assert.equal(JSON.stringify(saved.data).includes(body.token), false);
  t.db.close();
});

test("Gemini adapter sends source, feedback instructions and inline photos and omits thought text", async () => {
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    assert.equal(init.headers["x-goog-api-key"], "test-key");
    sent = JSON.parse(init.body);
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "내부 사고" },
              { text: "학생 수정 과제" },
            ],
          },
        },
      ],
    });
  };
  try {
    const r = await runGemini("test-key", "gemini-3.5-flash-lite", {
      max_completion_tokens: 1600,
      messages: [
        { role: "system", content: "대신 쓰지 않고 피드백한다." },
        {
          role: "user",
          content: [
            { type: "text", text: "사진을 그대로 읽는다." },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,YQ==" },
            },
          ],
        },
      ],
    });
    assert.equal(r.choices[0].message.content, "학생 수정 과제");
    assert.equal(sent.contents[0].parts[1].inlineData.data, "YQ==");
    assert.match(sent.systemInstruction.parts[0].text, /피드백/);
  } finally {
    globalThis.fetch = original;
  }
});

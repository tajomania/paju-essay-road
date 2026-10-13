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
      schoolEmail: "a@goedu.kr",
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
          schoolEmail: "b@goedu.kr",
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
    "disabled",
  );
  assert.equal(t.db.prepare("SELECT count(*) n FROM teacher_ai").get().n, 0);
  t.db.close();
});

test("personal classroom routes analysis to its teacher account and enforces its daily limit", async () => {
  const t = setup(),
    a = await t.teacher(),
    c = await t.classroom(a.cookie),
    s = await t.student(c.code),
    schoolEmail = "a@goedu.kr",
    token = "test-personal-token-1234567890";
  await t.req(
    "/teacher-ai",
    "PUT",
    { mode: "personal", schoolEmail, token, consent: true, dailyLimit: 1 },
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    assert.equal(init.headers["x-goog-api-key"], token);
    sent = JSON.parse(init.body);
    return Response.json({candidates: [{finishReason: "STOP", content: {parts: [{text: "주제 후보 3개"}]}}]});
  };
  try {
    assert.equal(
      (await t.req("/ai", "POST", { action: "topics" }, s.cookie)).status,
      200,
    );
    assert.match(sent.contents[0].parts[0].text, /건축/);
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
      schoolEmail: "a@goedu.kr",
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
    assert.match(r.data.error, /키/);
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

 test("only school Google registration is allowed and unconfigured teachers cannot use shared AI", async () => {
 const t=setup(), a=await t.teacher(), c=await t.classroom(a.cookie), st=await t.student(c.code);
 let calls=0; t.env.AI={run:async()=>{calls++;return {response:"shared"}}}; t.env.OPENAI_API_KEY="must-not-use";
 await t.req("/work","PUT",{career:"생태"},st.cookie);
 assert.equal((await t.req("/ai","POST",{action:"topics"},st.cookie)).status,503);
 for(const b of [{mode:"shared"},{mode:"personal",provider:"cloudflare"},{mode:"personal",schoolEmail:"teacher@gmail.com",consent:true,token:"test-google-api-key-123456789"}]) assert.equal((await t.req("/teacher-ai","PUT",b,a.cookie)).status,400);
 assert.equal(calls,0); t.db.close();
 });

test("legacy Cloudflare connection is inactive without deleting stored credentials", async () => {
 const t=setup(), a=await t.teacher();
 t.db.prepare("INSERT INTO teacher_ai (teacher_id,mode,account_id,token_cipher,daily_limit,updated,provider,model) VALUES (?,?,?,?,?,?,?,?)").run(a.data.id || t.db.prepare("SELECT id FROM teachers").get().id,"personal","a".repeat(32),"legacy-encrypted-data",150,new Date().toISOString(),"cloudflare","gemini-3.5-flash-lite");
 const r=await t.req("/teacher-ai","GET",{},a.cookie);
 assert.equal(r.data.mode,"disabled"); assert.equal(r.data.available,false); assert.equal(r.data.configured,false);
 assert.equal(t.db.prepare("SELECT token_cipher FROM teacher_ai").get().token_cipher,"legacy-encrypted-data"); t.db.close();
});

test("missing consent blocks key storage with actionable guidance", async () => {
 const t=setup(), a=await t.teacher();
 const b={mode:"personal",schoolEmail:"teacher@goedu.kr",token:"test-google-api-key-123456789"};
 const r=await t.req("/teacher-ai","PUT",b,a.cookie);
 assert.equal(r.status,400); assert.match(r.data.error,/체크박스/);
 assert.equal(t.db.prepare("SELECT count(*) n FROM teacher_ai").get().n,0);
 assert.equal((await t.req("/teacher-ai/test","POST",{},a.cookie)).status,503);
 assert.equal((await t.req("/teacher-ai","PUT",{...b,consent:true},a.cookie)).data.configured,true);
 t.db.close();
});

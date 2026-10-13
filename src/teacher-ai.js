import { runGemini } from "./gemini.js";
const enc = new TextEncoder();
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const bytes = (string) => Uint8Array.from(atob(string), (c) => c.charCodeAt(0));
async function key(env) {
  if (!env.AI_KEY_ENCRYPTION_SECRET)
    fail(503, "교사별 연결의 암호화 설정이 필요합니다. 운영자에게 문의하세요.");
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest(
      "SHA-256",
      enc.encode(env.AI_KEY_ENCRYPTION_SECRET),
    ),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptToken(env, teacherId, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(teacherId) },
    await key(env),
    enc.encode(token),
  );
  return b64(iv) + "." + b64(new Uint8Array(cipher));
}
async function decryptToken(env, teacherId, cipher) {
  try {
    const [iv, data] = cipher.split(".");
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: bytes(iv),
          additionalData: enc.encode(teacherId),
        },
        await key(env),
        bytes(data),
      ),
    );
  } catch {
    fail(
      503,
      "저장된 AI 연결을 읽을 수 없습니다. 교사가 연결 정보를 다시 저장해 주세요.",
    );
  }
}
export async function settings(env, teacherId) {
  return await env.DB.prepare("SELECT * FROM teacher_ai WHERE teacher_id=?")
    .bind(teacherId)
    .first();
}
export function status(env, row) {
  const mode = row?.mode || (env.LOCAL_MODE ? "disabled" : "shared");
  return {
    mode,
    local: !!env.LOCAL_MODE,
    provider: row?.provider || (env.LOCAL_MODE ? "google" : "cloudflare"),
    model: row?.model || "gemini-3.5-flash-lite",
    accountId: row?.account_id || "",
    configured: mode === "personal" && !!row?.token_cipher,
    dailyLimit: row?.daily_limit || 150,
    updated: row?.updated || null,
    personalAvailable: !!env.AI_KEY_ENCRYPTION_SECRET,
    available:
      env.AI_ENABLED === "true" &&
      (mode === "personal"
        ? !!row?.token_cipher && !!env.AI_KEY_ENCRYPTION_SECRET
        : mode === "shared" && !!(env.AI || env.OPENAI_API_KEY)),
  };
}
export async function aiEnvironment(env, teacherId) {
  const row = await settings(env, teacherId);
  if (row?.mode === "disabled")
    return {
      ...env,
      AI_ENABLED: "false",
      AI: undefined,
      OPENAI_API_KEY: undefined,
    };
  if (row?.mode !== "personal") return env;
  const token = await decryptToken(env, teacherId, row.token_cipher);
  if (row.provider === "google") {
    if (!env.LOCAL_MODE)
      fail(403, "학교 Google 계정 연결은 로컬 설치 버전에서 사용하세요.");
    return {
      ...env,
      OPENAI_API_KEY: undefined,
      PERSONAL_AI_TEACHER_ID: teacherId,
      PERSONAL_AI_DAILY_LIMIT: row.daily_limit,
      AI: {
        run: (_model, input) =>
          runGemini(token, row.model || "gemini-3.5-flash-lite", input),
      },
    };
  }
  return {
    ...env,
    OPENAI_API_KEY: undefined,
    PERSONAL_AI_TEACHER_ID: teacherId,
    PERSONAL_AI_DAILY_LIMIT: row.daily_limit,
    AI: {
      async run(model, input) {
        let response;
        try {
          response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${row.account_id}/ai/run/${model}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(input),
              signal: AbortSignal.timeout(90000),
            },
          );
        } catch {
          fail(
            502,
            "교사 개인 AI에 연결하지 못했습니다. 연결 상태를 확인해 주세요.",
          );
        }
        if (response.status === 401 || response.status === 403)
          fail(
            502,
            "교사 개인 AI 토큰의 계정과 Workers AI 권한을 확인해 주세요.",
          );
        if (response.status === 429)
          fail(429, "교사 개인 Cloudflare AI 계정의 이용 한도에 도달했습니다.");
        if (!response.ok)
          fail(
            502,
            "교사 개인 AI 요청에 실패했습니다. 계정 설정과 이용량을 확인해 주세요.",
          );
        const data = await response.json();
        if (!data.success || !data.result)
          fail(502, "교사 개인 AI가 결과를 반환하지 않았습니다.");
        return data.result;
      },
    },
  };
}

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
  const configured = row?.mode === "personal" && row?.provider === "google" && !!row?.token_cipher && /^[^@\s]+@goedu\.kr$/.test(row?.account_id || "");
  return {
    mode: configured ? "personal" : "disabled", local: !!env.LOCAL_MODE,
    provider: "google", schoolEmail: configured ? row.account_id : "",
    model: row?.model || "gemini-3.1-flash-lite", configured,
    dailyLimit: row?.daily_limit || 150, updated: row?.updated || null,
    personalAvailable: !!env.AI_KEY_ENCRYPTION_SECRET,
    available: env.AI_ENABLED === "true" && configured && !!env.AI_KEY_ENCRYPTION_SECRET,
  };
}
export async function aiEnvironment(env, teacherId) {
  const row = await settings(env, teacherId);
  const base = { ...env, AI: undefined, OPENAI_API_KEY: undefined };
  if (!status(env, row).available) return { ...base, AI_ENABLED: "false" };
  const token = await decryptToken(env, teacherId, row.token_cipher);
  return {
    ...base, PERSONAL_AI_TEACHER_ID: teacherId,
    PERSONAL_AI_DAILY_LIMIT: row.daily_limit,
    AI: { run: (_model, input) => runGemini(token, row.model || "gemini-3.1-flash-lite", input) },
  };
}

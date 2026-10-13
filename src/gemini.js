const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
// Never return Google response text: it can include project IDs and credentials.
async function handleGoogleError(response) {
  let data;
  try { data = await response.json(); } catch { data = {}; }
  const error = data.error || {};
  const reasons = (error.details || []).map(d => d.reason || "");
  const message = String(error.message || "").toLowerCase();
  const tag = `Google HTTP ${response.status}`;
  if (reasons.includes("API_KEY_INVALID") || /api key not valid|invalid api key|api_key_invalid/.test(message))
    fail(502, `[${tag} · KEY_INVALID] API 키가 유효하지 않습니다. 학교 계정의 Google AI Studio에서 Gemini API 키를 새로 발급해 저장하세요. Google 로그인 비밀번호나 다른 서비스용 키는 사용할 수 없습니다.`);
  if (/reported as leaked|leaked/.test(message))
    fail(502, `[${tag} · KEY_BLOCKED] Google이 노출된 키로 차단했습니다. AI Studio에서 새 키를 발급해 다시 저장하세요.`);
  if (reasons.includes("SERVICE_DISABLED") || /has not been used|is disabled/.test(message))
    fail(502, `[${tag} · API_DISABLED] 키의 프로젝트에서 Generative Language API가 비활성화됐습니다. 학교 프로젝트 관리자에게 API 활성화를 요청하세요.`);
  if (reasons.some(r => /^API_KEY_(HTTP_REFERRER|IP_ADDRESS|SERVICE)_BLOCKED$/.test(r)))
    fail(502, `[${tag} · KEY_RESTRICTION] 키의 웹사이트·IP·API 제한이 요청을 차단했습니다. 이 앱은 교사 PC 또는 웹앱 서버에서 호출합니다. 프로젝트 관리자에게 실행 위치에 맞는 키 제한을 확인하세요.`);
  if (response.status === 402 || /billing|prepay|credit|free tier.*not available|not available.*free tier/.test(message))
    fail(502, `[${tag} · BILLING] 이 프로젝트의 무료 이용 가능 여부 또는 결제·크레딧 설정을 AI Studio에서 확인하세요. 학교 프로젝트 관리자의 조치가 필요할 수 있습니다.`);
  if (response.status === 429)
    fail(429, `[${tag} · QUOTA] Google API 이용 한도에 도달했습니다. 잠시 후 다시 시도하고 계속 실패하면 AI Studio의 모델별 한도·사용량을 확인하세요.`);
  if (response.status === 401 || response.status === 403)
    fail(502, `[${tag} · PERMISSION] API 키의 프로젝트 권한, 키 제한과 학교 관리자 정책을 확인하세요.`);
  if (response.status === 404)
    fail(502, `[${tag} · MODEL_NOT_FOUND] 저장한 모델을 사용할 수 없습니다. 모델 이름과 계정에서 제공하는 모델을 확인하세요.`);
  if (response.status === 400)
    fail(502, `[${tag} · INVALID_REQUEST] Google이 요청을 거절했습니다. Gemini API 키와 모델 이름을 확인하세요. 무료 이용·프로젝트 설정도 AI Studio에서 확인할 수 있습니다.`);
  if ([408, 500, 502, 503, 504].includes(response.status))
    fail(503, `[${tag} · TEMPORARY_UNAVAILABLE] Google 서비스의 일시적인 오류입니다. 자동 재시도 후에도 응답하지 않았습니다. API 키를 다시 발급하지 말고 잠시 후 연결 테스트를 실행하세요.`);
  fail(502, `[${tag} · PROVIDER_ERROR] Google API가 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.`);
}
export async function runGemini(token, model, input) {
  const system = input.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const contents = input.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts:
        typeof m.content === "string"
          ? [{ text: m.content }]
          : m.content.map((p) => {
              if (p.type === "text") return { text: p.text };
              const match = p.image_url?.url.match(
                /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/,
              );
              if (!match) fail(400, "사진 입력 형식을 확인하세요.");
              return { inlineData: { mimeType: match[1], data: match[2] } };
            }),
    }));
  let response;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            maxOutputTokens: (input.max_completion_tokens || 1600) + 2048,
          },
        }),
        signal: AbortSignal.timeout((input.max_completion_tokens || 1600) <= 60 ? 15000 : 60000),
      },
    );
    if (![408, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    // Do not retry credential, permission, billing or quota errors.
    if (response.body) await response.body.cancel();
    await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt)));
    }
  } catch (error) {
    if (response && [408, 500, 502, 503, 504].includes(response.status))
      await handleGoogleError(response);
    if (error?.name === "TimeoutError" || error?.name === "AbortError")
      fail(504, "[GOOGLE_TIMEOUT] Google 서버의 응답이 지연되고 있습니다. 잠시 후 연결 테스트를 다시 실행하세요.");
    if (/CERT|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/.test(error?.cause?.code || ""))
      fail(502, "[NETWORK_TLS] 학교망의 인증서 검사로 Google 연결이 차단됐습니다. 학교 전산 담당자에게 generativelanguage.googleapis.com의 인증서 신뢰 설정을 확인하세요.");
    fail(
      502,
      "Google Gemini에 연결하지 못했습니다. 교사 컴퓨터의 인터넷 연결을 확인하세요.",
    );
  }
  if (!response.ok) await handleGoogleError(response);
  const result = await response.json(),
    candidate = result.candidates?.[0];
  const content = (candidate?.content?.parts || [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("\n");
  if (!content)
    fail(
      502,
      "Gemini가 분석 결과를 반환하지 않았습니다. 입력 내용을 확인하세요.",
    );
  return {
    choices: [
      {
        message: { content },
        finish_reason:
          candidate.finishReason === "MAX_TOKENS" ? "length" : "stop",
      },
    ],
  };
}

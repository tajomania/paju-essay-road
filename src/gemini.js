const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
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
        signal: AbortSignal.timeout(90000),
      },
    );
  } catch {
    fail(
      502,
      "Google Gemini에 연결하지 못했습니다. 교사 컴퓨터의 인터넷 연결을 확인하세요.",
    );
  }
  if (response.status === 401 || response.status === 403)
    fail(
      502,
      "Gemini API 키 또는 학교 Google 계정의 AI Studio·프로젝트 권한을 확인하세요.",
    );
  if (response.status === 429)
    fail(429, "교사 Gemini 계정의 API 이용 한도에 도달했습니다.");
  if (response.status === 404)
    fail(
      502,
      "선택한 Gemini 모델을 이 계정에서 사용할 수 없습니다. 모델 이름을 확인하세요.",
    );
  if (!response.ok)
    fail(
      502,
      "Gemini 분석에 실패했습니다. API 키, 프로젝트와 이용량을 확인하세요.",
    );
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

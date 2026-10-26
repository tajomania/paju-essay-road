import { exportRecordsXlsx } from "./export-xlsx.js";
const $ = (s) => document.querySelector(s),
  app = $("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const state = {
  me: null,
  work: {},
  feedback: [],
  step: 1,
  class: null,
  tab: "material",
  students: [],
  photos: [],
  ai: {},
  saving: null,
};
let toastTimer,
  saveTimer,
  saveChain = Promise.resolve(),
  version = 0,
  savedVersion = 0;
async function api(path, method = "GET", data) {
  const r = await fetch(`/api${path}`, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(data || {}),
  });
  let d;
  try {
    d = await r.json();
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 배포 설정을 확인해 주세요.");
  }
  if (!r.ok) throw new Error(d.error || "요청에 실패했습니다.");
  return d;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").className = `show ${error ? "error" : ""}`;
  toastTimer = setTimeout(() => ($("#toast").className = ""), 6000);
}
function on(selector, event, handler) {
  document
    .querySelectorAll(selector)
    .forEach((el) => el.addEventListener(event, handler));
}
async function busy(button, fn) {
  const old = button.textContent;
  button.disabled = true;
  button.textContent = "처리 중…";
  try {
    return await fn();
  } catch (e) {
    toast(e.message, true);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = old;
    }
  }
}
function modal(html) {
  $("#dialog-content").innerHTML = html;
  $("#dialog").showModal();
}
$("#close-dialog").onclick = () => $("#dialog").close();
$("#privacy").onclick = () =>
  modal(
    `<h2>이용·개인정보 안내</h2><p>실명 대신 수업용 별명을 사용하세요. 교사 ID, 교사가 등록한 학교 이메일, 암호화된 비밀번호, 수업 자료, 글쓰기 기록, AI 피드백, 게시글과 댓글을 저장합니다. 학생 초안과 수정 기록은 해당 학생과 수업 교사에게만 제공하며, 주제와 완성 글은 학생이 공유할 때 같은 학급에 공개합니다.</p><p>AI 요청 시 읽기 자료, 관심 분야, 초안 또는 사진이 교사가 등록한 학교 Google Gemini API로 전송됩니다. Google의 API 데이터 처리 정책이 적용됩니다. 사진 원본은 앱 서버에 저장하지 않으며, 선택한 사진은 화면을 떠나거나 새로고침하면 사라집니다.</p><p>교사는 수업 기록을 내려받고 수업을 삭제할 수 있습니다. 학교의 학생 개인정보 처리 안내에 따라 이용하세요. AI 피드백은 오류가 있을 수 있으므로 학생과 교사가 검토합니다. AI 기능은 교사 학교 API 계정의 사용량 한도 내에서 제공됩니다.</p><p>학생 비밀번호를 잊으면 수업 교사에게 초기화를 요청하세요. 교사는 가입할 때 발급된 복구 코드로 비밀번호를 바꿀 수 있습니다. 자동 로그아웃은 로그인 후 7일입니다.</p>`,
  );
const materials = [
  {
    title: "책을 만드는 도시, 나의 질문을 만드는 읽기",
    body: "한 권의 책은 한 사람의 생각만으로 만들어지지 않는다. 글을 쓰는 사람, 내용을 다듬는 사람, 표지와 지면을 설계하는 사람, 책을 인쇄하고 독자에게 전달하는 사람이 함께한다. 파주의 책과 출판 문화를 출발점으로 살펴보면, 읽기는 여러 직업과 연결되는 활동이기도 하다.\n\n디지털 환경에서 정보는 빠르게 만들어지고 퍼진다. 그러나 빠른 전달이 곧 깊은 이해를 뜻하지는 않는다. 독자는 누가 어떤 목적에서 쓴 글인지, 주장을 뒷받침하는 근거는 무엇인지, 빠진 관점은 없는지 질문해야 한다. 인공지능이 요약한 내용을 읽을 때도 이러한 질문은 필요하다.\n\n책을 만드는 과정과 책을 읽는 과정에는 공통점이 있다. 자신의 판단을 다른 사람과 나누고, 타인의 관점을 통해 생각을 바꾸는 것이다. 어떤 기술을 쓰더라도 무엇을 표현하고 무엇을 믿을지 판단하는 책임은 사람에게 남는다.\n\n나의 희망 분야에서는 읽기와 정보 판단이 어떤 역할을 할까? 지역의 독서 문화에 내가 기여할 수 있는 방법은 무엇일까? 책의 형태가 달라져도 지켜야 할 가치는 무엇일까?",
    source: "수업용 자체 작성 탐구 글 · 지역 세부 정보는 교사가 별도 확인",
    type: "paju",
  },
  {
    title: "경계에서 생각하는 평화와 일상의 삶",
    body: "파주를 떠올릴 때 접경 지역과 평화를 함께 생각할 수 있다. 평화는 먼 곳에서 결정되는 큰 사건만을 뜻할까? 서로 다른 사람들이 안전하게 생활하고 의견을 나눌 수 있는 일상도 평화의 한 모습일 수 있다.\n\n지역의 삶을 이해하려면 하나의 이미지로 주민의 경험을 단정하지 않아야 한다. 어떤 사람은 이동과 생활의 편의를 중요하게 생각하고, 다른 사람은 역사와 기억을 보존하는 일을 우선할 수 있다. 서로 다른 필요를 확인하고 조정하는 과정에는 여러 분야의 지식이 쓰인다.\n\n도시를 설계하는 사람은 접근성과 안전을 고민한다. 교육자는 서로 다른 경험을 이해하는 배움을 설계한다. 언론인은 지역의 다양한 목소리를 듣고 전달한다. 기술을 개발하는 사람은 누구나 정보를 얻고 소통할 수 있는 방법을 찾는다.\n\n나의 희망 분야에서는 평화를 어떤 문제로 다룰 수 있을까? 주민의 목소리를 이해하려면 누구의 이야기를 듣고 어떤 자료를 확인해야 할까? 추상적인 가치를 실제 생활의 변화로 연결하는 방법을 생각해 보자.",
    source:
      "수업용 자체 작성 탐구 글 · 특정 사건이나 정책을 설명하는 자료가 아닙니다.",
    type: "paju",
  },
  {
    title: "지역의 변화, 누구를 위한 발전인가",
    body: "파주의 지역 환경을 탐구할 때 자연환경과 주민 생활, 지역의 변화라는 관점을 함께 살펴볼 수 있다. 새로운 공간과 시설은 생활을 편리하게 만들 수 있지만, 그 과정에서 자연과 기존 공동체에 미치는 영향도 검토해야 한다.\n\n발전을 판단하는 기준은 하나가 아니다. 경제적 기회, 이동 시간, 생태환경, 문화와 기억, 삶의 질은 서로 다른 기준이다. 같은 변화라도 누군가에게는 이익이 되고 다른 사람에게는 부담이 될 수 있다. 따라서 좋은 결정을 위해서는 전체의 이익이라는 표현만으로 설명하기 어려운 구체적인 영향을 살펴야 한다.\n\n자신의 관점을 세우는 일과 다른 관점을 검토하는 일은 함께 이루어져야 한다. 어떤 주장이 설득력을 가지려면 확인할 수 있는 근거가 필요하다. 통계나 사례를 사용할 때는 출처와 시점, 비교 대상도 확인해야 한다.\n\n나의 희망 분야에서는 지역의 변화를 어떤 기준으로 평가할까? 주민과 자연환경에 미치는 영향을 확인하기 위해 어떤 자료가 필요할까? 서로 다른 기준이 충돌할 때 어떤 원칙으로 선택해야 할까?",
    source:
      "수업용 자체 작성 탐구 글 · 특정 개발 사업이나 지역 통계를 포함하지 않습니다.",
    type: "paju",
  },
];
function field(key, label, placeholder = "", rows = 3) {
  return `<label for="w-${key}">${label}</label><textarea id="w-${key}" data-work="${key}" rows="${rows}" maxlength="${["draft", "final"].includes(key) ? 15000 : 4000}" placeholder="${esc(placeholder)}">${esc(state.work[key])}</textarea>`;
}
function check(key, label) {
  return `<label class="check"><input type="checkbox" data-work="${key}" ${state.work[key] ? "checked" : ""}>${label}</label>`;
}
function account() {
  $("#account").innerHTML = state.me
    ? `<span>${state.me.role === "teacher" ? "교사 작업실" : esc(state.me.nickname)}</span><button class="secondary" id="logout">로그아웃</button>`
    : "";
  if ($("#logout"))
    $("#logout").onclick = () =>
      busy($("#logout"), async () => {
        if (state.me.role === "student") await flush();
        await api("/logout", "POST");
        state.me = null;
        state.work = {};
        state.ai = {};
        state.photos = [];
        account();
        home();
      });
}
function home() {
  app.innerHTML = `<section class="hero"><div><span class="eyebrow">지역에서 발견하고 · 나의 생각으로 쓰다</span><h1>파주, 텍스트로 걷고<br>나의 길을 사유하다</h1><p>파주의 이야기를 읽고 나의 진로와 연결해 보세요.<br>AI의 질문을 따라 생각을 넓히고, 내 문장으로 완성하는<br>네 단계 에세이 수업입니다.</p><span class="tag">설치 없이, 주소 하나로 시작하는 수업</span></div><div class="hero-art" aria-hidden="true"><div class="paper-card"><span class="dot"></span><div class="line"></div><b>My question.<br>My words.</b><div class="line"></div><div class="line"></div></div><span class="hero-label">읽기에서 진로로, 질문에서 글로 ↗</span></div></section><section class="role-grid"><div class="card role-card"><span class="tag">STUDENT · 휴대폰 / 태블릿</span><h2>학생으로 참여하기</h2><p class="muted">교사와 같은 웹주소에서 수업 코드를 입력하세요.<br>휴대폰·태블릿에서도 설치 없이 참여합니다.</p><form id="join-class-form"><label for="join-code">선생님이 알려 준 수업 코드</label><input id="join-code" maxlength="8" minlength="8" pattern="[A-Za-z0-9]{8}" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="8자리 수업 코드"><button id="student-start" type="submit" class="full actions">코드로 수업 참여하기 →</button></form></div><div class="card role-card"><span class="tag">TEACHER · 컴퓨터 권장</span><h2>교사로 수업 만들기</h2><p class="muted">웹에서 로그인하고 수업 방을 만드세요.<br>자동 발급된 수업 코드를 학생에게 알려 주세요.</p><button id="teacher-start" class="secondary">교사 작업실 열기 →</button><a href="/classroom-guide.html">설치 없이 사용하는 웹 수업 안내 ↗</a></div></section><section class="steps-intro"><div><i>01</i><b>함께 읽기</b><span>파주 소재 또는 교사 키워드</span></div><div><i>02</i><b>질문 발견하기</b><span>진로에서 찾는 나만의 주제</span></div><div><i>03</i><b>직접 쓰고 고치기</b><span>초안 촬영과 질문 중심 피드백</span></div><div><i>04</i><b>글과 생각 나누기</b><span>완성 글, 댓글, 성찰</span></div></section>`;
  $("#join-class-form").onsubmit = (event) => {
    event.preventDefault();
    const code = $("#join-code").value.trim().toUpperCase();
    const url = new URL(location.href);
    url.searchParams.set("class", code);
    history.replaceState(null, "", url);
    auth("student", "register");
  };
  $("#teacher-start").onclick = () => auth("teacher");
}
function auth(role, mode = "login") {
  const student = role === "student",
    register = mode === "register",
    recover = mode === "recover";
  const code = new URLSearchParams(location.search).get("class") || "";
  app.innerHTML = `<section class="card auth"><button id="back-home" class="text-button">← 처음으로</button><span class="eyebrow">${student ? "나의 글쓰기 여정" : "교사 작업실"}</span><h2>${student ? "수업에 참여하세요" : recover ? "교사 계정 복구" : "수업을 준비하세요"}</h2><div class="tabs"><button id="login-tab" class="${mode === "login" ? "active" : ""}">${student ? "다시 참여하기" : "로그인"}</button><button id="register-tab" class="${register ? "active" : ""}">${student ? "처음 참여하기" : "교사 가입"}</button></div><form id="auth-form">${student ? `<label for="code">수업 코드</label><input id="code" name="code" maxlength="16" value="${esc(code)}" required autocomplete="off" placeholder="선생님이 공유한 8자리 코드" autocapitalize="characters" spellcheck="false">` : ""}<label for="username">${student ? "수업용 별명" : "교사 ID"}</label><input id="username" name="username" required maxlength="${student ? 30 : 60}" autocomplete="username" placeholder="${student ? "실명 대신 별명을 사용해 주세요" : "사용할 ID를 입력하세요"}">${recover ? '<label for="recovery">가입 시 발급된 복구 코드</label><input id="recovery" name="recovery" required autocomplete="off">' : ""}<label for="password">${recover ? "새 " : ""}비밀번호</label><input id="password" name="password" type="password" required minlength="${student ? 6 : 10}" maxlength="128" autocomplete="${register || recover ? "new-password" : "current-password"}" placeholder="${student ? "6" : "10"}자 이상">${!student && register ? '<label for="invite">교사 가입 초대 코드 (운영자가 지정한 경우)</label><input id="invite" name="invite" autocomplete="off">' : ""}${register ? '<label class="check"><input type="checkbox" required>이용·개인정보 안내를 확인했습니다. 학교의 수업 운영 지침에 따라 참여합니다.</label>' : ""}<button type="submit" class="full actions">${recover ? "비밀번호 바꾸기" : register ? "가입하고 시작하기" : "로그인하고 이어가기"}</button></form>${!student ? '<button id="recover" class="text-button">비밀번호를 잊었어요</button>' : '<p class="muted">같은 코드·별명·비밀번호로 다른 기기에서도 이어서 참여할 수 있어요. 비밀번호를 잊으면 선생님께 문의하세요.</p>'}</section>`;
  $("#back-home").onclick = home;
  $("#login-tab").onclick = () => auth(role);
  $("#register-tab").onclick = () => auth(role, "register");
  if ($("#recover")) $("#recover").onclick = () => auth(role, "recover");
  $("#auth-form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const f = new FormData(e.target);
      const d = await api(
        student
          ? "/auth/student"
          : `/auth/teacher-${recover ? "recover" : register ? "register" : "login"}`,
        "POST",
        {
          code: f.get("code"),
          nickname: f.get("username"),
          username: f.get("username"),
          password: f.get("password"),
          invite: f.get("invite"),
          recovery: f.get("recovery"),
          register,
        },
      );
      await loadMe();
      if (d.recovery)
        modal(
          `<h2>교사 복구 코드를 보관하세요</h2><p>비밀번호를 잊었을 때 필요합니다. 이 코드는 지금 한 번만 표시됩니다. 다른 사람에게 공유하지 마세요.</p><div class="recover-note">${esc(d.recovery)}</div>`,
        );
    });
  };
}
async function loadMe() {
  state.me = await api("/me");
  account();
  if (state.me.role === "teacher") {
    state.class = null;
    teacherHome();
  } else {
    const d = await api("/work");
    state.work = d.data;
    version = 0;
    savedVersion = 0;
    state.feedback = d.feedback;
    state.class = state.me.class;
    state.step = 1;
    studentScreen();
  }
}
function saveIndicator(message) {
  document
    .querySelectorAll(".save-status")
    .forEach((e) => (e.textContent = message));
}
function bindWork() {
  on("[data-work]", "input", (e) => {
    const key = e.target.dataset.work;
    state.work[key] =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (key === "draft") state.work.ocrConfirmed = false;
    version++;
    saveIndicator("저장 대기…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(
      () => flush().catch((e) => toast(e.message, true)),
      1000,
    );
  });
}
function flush() {
  clearTimeout(saveTimer);
  if (!state.class?.active || version === savedVersion) return saveChain;
  const snapshot = { ...state.work },
    v = version;
  saveChain = saveChain
    .catch(() => {})
    .then(async () => {
      saveIndicator("저장 중…");
      try {
        await api("/work", "PUT", snapshot);
        savedVersion = v;
        saveIndicator(
          v === version ? "서버에 저장됨" : "새 변경 사항 저장 대기…",
        );
      } catch (e) {
        saveIndicator("저장 실패 · 다시 저장해 주세요");
        throw e;
      }
    });
  return saveChain;
}
async function go(step) {
  try {
    await flush();
    state.step = step;
    studentScreen();
    window.scrollTo({ top: 0 });
  } catch (e) {
    toast(e.message, true);
  }
}
function studentScreen() {
  const c = state.class,
    m = c.material;
  app.innerHTML = `<div class="workspace-header"><div><span class="eyebrow">STUDENT WORKSPACE</span><h1>${esc(c.title)}</h1><p class="muted">${esc(state.me.nickname)}님의 글쓰기 기록 · ${c.active ? "수업 진행 중" : "종료된 수업 · 기록 열람"}</p></div><div class="actions"><span class="save-status">서버에 저장됨</span><button id="save-now" class="secondary">저장</button></div></div>${!state.me.ai ? '<div class="notice warn">AI가 아직 연결되지 않았습니다. 직접 읽고 쓰기와 학급 공유는 사용할 수 있습니다.</div>' : ""}<div class="layout"><nav class="sidebar" aria-label="글쓰기 단계">${["함께 읽기", "질문 발견하기", "쓰고 고치기", "글 나누기"].map((name, i) => `<button data-step="${i + 1}" class="${state.step === i + 1 ? "active" : ""}" ${state.step === i + 1 ? 'aria-current="step"' : ""}><span class="num">0${i + 1}</span>${name}</button>`).join("")}<small>AI는 글을 대신 쓰지 않아요.<br>선택과 문장은 여러분의 몫입니다.</small></nav><section class="student-content"><div class="section-title"><span>0${state.step} / 04</span><h2>${["함께 읽기", "나의 질문 발견하기", "직접 쓰고 고치기", "글과 생각 나누기"][state.step - 1]}</h2></div><div id="step-content"></div><div class="nav-actions"><button id="prev-step" class="secondary" ${state.step === 1 ? "disabled" : ""}>← 이전 단계</button><button id="next-step" ${state.step === 4 ? "disabled" : ""}>다음 단계 →</button></div></section></div>`;
  on("[data-step]", "click", (e) => go(Number(e.currentTarget.dataset.step)));
  $("#save-now").onclick = () =>
    busy($("#save-now"), () =>
      flush().then(() => toast("글쓰기 기록을 저장했습니다.")),
    );
  $("#prev-step").onclick = () => go(state.step - 1);
  $("#next-step").onclick = () => go(state.step + 1);
  if (state.step === 1) stepRead(m);
  if (state.step === 2) stepTopic();
  if (state.step === 3) stepDraft();
  if (state.step === 4) stepShare();
  bindWork();
  if (!c.active) {
    document
      .querySelectorAll(
        "[data-work],#save-now,#images,#ocr,#feedback-ai,#topics-ai,#explain,#publish,#unpublish,[data-comment] button,[data-comment] textarea",
      )
      .forEach((el) => (el.disabled = true));
  }
}
function output(name) {
  return `<div id="out-${name}" class="ai-output" ${state.ai[name] ? "" : "hidden"}>${esc(state.ai[name])}</div>`;
}
function bindAi(id, action, extra = () => ({})) {
  if (!$(id)) return;
  $(id).onclick = (e) =>
    busy(e.currentTarget, async () => {
      await flush();
      const d = await api("/ai", "POST", { action, ...extra() });
      state.ai[action] = d.text;
      const el = $(`#out-${action}`);
      if (el) {
        el.textContent = d.text;
        el.hidden = false;
      }
      if (action === "feedback") {
        const w = await api("/work");
        state.feedback = w.feedback;
        toast("수정할 부분을 확인하고 내 문장으로 고쳐 보세요.");
      }
    });
}
function stepRead(m) {
  $("#step-content").innerHTML = m.body
    ? `<div class="two-col"><article class="card"><div class="help-row"><span class="tag">학급 공통 읽기 자료${m.type === "ai" ? " · AI 생성 / 교사 검토" : ""}</span><button id="font-size" class="text-button">글자 크게</button></div><h3>${esc(m.title)}</h3><div class="reading" id="reading">${esc(m.body)}</div><div class="reading-source">${esc(m.source)}</div></article><div class="card"><h3>읽고, 내 생각 남기기</h3>${field("keywords", "진로와 연결되는 키워드 3가지", "읽기 자료에서 찾은 연결 고리를 적어 보세요.", 2)}${field("memo", "핵심 내용 · 인상 깊은 부분 · 궁금한 점", "어떤 내용이 기억에 남았나요? 그 이유를 내 말로 적어 보세요.", 7)}<label for="concept">이해가 필요한 낱말이나 개념</label><input id="concept" maxlength="300" placeholder="설명이 필요한 개념을 입력하세요"><div class="actions"><button id="explain" class="secondary">AI에게 개념 질문하기</button></div>${output("explain")}<div class="notice">AI 설명도 읽기 자료와 비교해 확인하세요. 읽기 메모는 직접 작성합니다.</div></div></div>`
    : '<div class="empty">선생님이 공통 읽기 자료를 준비하고 있습니다.<br>잠시 후 새로고침해 주세요.</div>';
  if ($("#font-size"))
    $("#font-size").onclick = () => {
      $("#reading").classList.toggle("large");
      $("#font-size").textContent = $("#reading").classList.contains("large")
        ? "기본 글자"
        : "글자 크게";
    };
  bindAi("#explain", "explain", () => ({ question: $("#concept").value }));
}
function stepTopic() {
  $("#step-content").innerHTML =
    `<div class="intro-band"><b>같은 글, 서로 다른 질문.</b><br>관심 분야와 읽기 메모를 연결해 나만의 탐구 질문을 찾아보세요. 주제 후보는 참고하고 주장과 개요는 직접 씁니다.</div><div class="two-col"><div class="card">${field("career", "희망 분야 또는 관심 분야", "예: 의료, 교육, 디자인, 아직 진로는 미정이지만 환경에 관심이 있어요.", 2)}<button id="topics-ai" class="secondary actions">AI 주제 후보 살펴보기</button>${output("topics")}${field("topic", "내가 선택하거나 직접 만든 중심 질문", "무엇을 탐구하고 싶은가요?", 2)}${field("claim", "나의 잠정 주장과 주제를 선택한 이유", "지금은 어떻게 생각하나요? 왜 이 질문을 골랐나요?", 3)}${field("outline", "내가 작성한 글쓰기 개요", "도입에서 던질 질문 / 본론의 주장과 근거 / 검토할 다른 관점 / 결론", 5)}${check("shareTopic", "중심 질문을 학급 주제 보드에 공유합니다.")}${check("shareCareer", "관심 분야를 주제 보드와 완성 글에 함께 공개합니다.")}</div><div class="card"><div class="help-row"><h3>우리 반의 질문 지도</h3><button id="refresh-topics" class="text-button">새로고침</button></div><p class="muted">같은 읽기 자료가 친구들의 진로와 만나 어떤 질문이 되었을까요?</p><div id="topics-board"></div>${field("comparison", "다른 분야에서 새롭게 발견한 관점", "친구의 질문을 읽고 내 질문과 어떤 차이가 있는지 적어 보세요.", 4)}</div></div>`;
  bindAi("#topics-ai", "topics");
  $("#refresh-topics").onclick = () => loadTopics();
  loadTopics();
}
async function loadTopics() {
  try {
    const d = await api("/topics");
    if (!$("#topics-board")) return;
    $("#topics-board").innerHTML = d.topics.length
      ? d.topics
          .map(
            (t) =>
              `<div class="book"><span class="tag">${esc(t.career)}</span><h3>${esc(t.topic)}</h3><small>${esc(t.nickname)}</small></div>`,
          )
          .join("")
      : '<div class="empty">아직 공유된 질문이 없어요.<br>내 질문을 저장하고 새로고침해 보세요.</div>';
  } catch (e) {
    toast(e.message, true);
  }
}
function stepDraft() {
  $("#step-content").innerHTML =
    `<div class="intro-band"><b>첫 문장부터 마지막 문장까지, 내가 씁니다.</b><br>종이에 쓴 초안을 촬영하거나 직접 입력하세요. AI가 읽은 글자를 확인한 뒤 피드백을 받고, 수정 여부를 스스로 결정합니다.</div><div class="two-col"><div class="card"><div class="upload"><label for="images">초안 사진 등록 · 최대 4장</label><p>사진 속 이름 등 개인정보를 가리고 글자가 선명하게 나오도록 촬영하세요. 등록 순서대로 읽습니다.</p><input id="images" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="photos" id="photos"></div></div><div class="actions"><button id="ocr" class="secondary">사진의 글자 읽기</button></div><div class="notice warn">사진을 분석하면 초안 입력창의 내용이 바뀝니다. 읽을 수 없는 부분은 [판독 불가]로 표시됩니다.</div>${field("draft", "내 에세이 초안 · 인식 오류를 직접 확인해 주세요", "직접 쓴 초안을 입력하거나 사진의 글자를 읽어 불러오세요.", 14)}${check("ocrConfirmed", "초안 텍스트를 확인했습니다. 사진 인식 오류가 있으면 수정했습니다.")}<p class="char-count" id="draft-count">${(state.work.draft || "").length}자 / 최대 15,000자</p><button id="feedback-ai" class="full">AI 피드백 받기</button></div><div class="card"><h3>질문으로 받는 피드백</h3><p class="muted">강점과 우선 수정할 점을 살펴보세요. AI는 대체 문장이나 완성 에세이를 써주지 않습니다.</p>${output("feedback")}<div id="feedback-history">${state.feedback.map((f) => `<details><summary>${esc(new Date(f.created).toLocaleString("ko-KR"))} 피드백</summary><div class="ai-output">${esc(f.content)}</div><details><summary>분석했던 초안 보기</summary><div class="reading">${esc(f.draft)}</div></details></details>`).join("") || '<div class="empty">피드백을 받으면 이곳에 표시됩니다.</div>'}</div>${field("revision", "피드백 반영 기록", "반영한 피드백과 수정 내용 / 일부 반영하거나 반영하지 않은 이유 / 추가로 확인한 자료", 6)}${field("rejection", "논리적 거절 사유서", "동의하지 않는 AI 제안 / 내 판단과 근거 / 나의 진로 가치관과 연결되는 이유", 5)}<div class="notice">AI의 판단에 동의하지 않아도 괜찮아요. 그 이유를 설명하는 것도 중요한 글쓰기 과정입니다.</div></div></div>`;
  $("#images").onchange = (e) =>
    busy($("#ocr"), async () => {
      const files = [...e.target.files];
      if (state.photos.length + files.length > 4)
        throw new Error("사진은 최대 4장입니다.");
      for (const f of files) {
        if (f.size > 15 * 1024 * 1024)
          throw new Error("사진 한 장은 15MB 이하로 선택하세요.");
        state.photos.push(await resizeImage(f));
      }
      renderPhotos();
      e.target.value = "";
    });
  renderPhotos();
  $("#ocr").onclick = (e) =>
    busy(e.currentTarget, async () => {
      if (!state.photos.length) throw new Error("먼저 사진을 등록해 주세요.");
      if (
        state.work.draft &&
        !confirm("현재 초안 입력창을 사진 인식 결과로 바꿀까요?")
      )
        return;
      await flush();
      const d = await api("/ai", "POST", {
        action: "ocr",
        images: state.photos,
      });
      state.work.draft = d.text;
      state.work.ocrConfirmed = false;
      version++;
      await flush();
      studentScreen();
      toast("사진과 텍스트를 비교해 인식 오류를 수정하세요.");
    });
  bindAi("#feedback-ai", "feedback");
  $("#w-draft").addEventListener("input", () => {
    $("#draft-count").textContent =
      `${$("#w-draft").value.length}자 / 최대 15,000자`;
    const ck = $('[data-work="ocrConfirmed"]');
    ck.checked = false;
  });
}
async function resizeImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG·PNG·WebP 사진을 선택하세요.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const result = canvas.toDataURL("image/jpeg", 0.78);
  if (result.length > 1800000)
    throw new Error("사진 용량이 큽니다. 해상도를 낮춰 다시 등록하세요.");
  return result;
}
function renderPhotos() {
  if (!$("#photos")) return;
  $("#photos").innerHTML = state.photos
    .map(
      (src, i) =>
        `<div class="photo"><img src="${src}" alt="초안 ${i + 1}번째 사진"><div class="actions"><button data-move="${i}" class="secondary" ${i === 0 ? "disabled" : ""}>앞으로</button><button data-remove="${i}" class="danger">삭제</button></div></div>`,
    )
    .join("");
  on("[data-remove]", "click", (e) => {
    state.photos.splice(Number(e.currentTarget.dataset.remove), 1);
    renderPhotos();
  });
  on("[data-move]", "click", (e) => {
    const i = Number(e.currentTarget.dataset.move);
    [state.photos[i - 1], state.photos[i]] = [
      state.photos[i],
      state.photos[i - 1],
    ];
    renderPhotos();
  });
}
function stepShare() {
  $("#step-content").innerHTML =
    `<div class="card"><h3>내 문장으로 완성하기</h3>${field("title", "에세이 제목", "글의 중심 생각을 담은 제목", 1)}${field("final", "최종 에세이", "초안을 수정하고 내 문장으로 완성해 보세요.", 12)}${field("reflection", "작성 소감과 성찰", "처음 생각과 달라진 점 / 수정하며 배운 점 / AI 피드백을 받아들이거나 거절한 이유", 4)}${field("aiDisclosure", "AI 활용 내역", "예: 주제 후보 탐색, 초안 글자 인식, 논리 피드백을 활용했습니다.", 2)}<div class="notice">게시한 최종 에세이와 소감은 같은 학급의 학생과 선생님에게 공개됩니다. 초안과 수정 기록은 선생님만 함께 확인할 수 있습니다.</div><div class="actions"><button id="preview-post" class="secondary">게시 전 미리보기</button><button id="publish">학급에 게시하기</button><button id="unpublish" class="text-button">내 게시글 내리기</button></div></div><div class="help-row actions"><h3>우리 반 에세이 모음</h3><button id="refresh-posts" class="secondary">새로고침</button></div><input id="post-search" class="search" placeholder="제목 · 주제 · 관심 분야 · 별명으로 검색" aria-label="게시글 검색"><div id="posts"></div>`;
  $("#preview-post").onclick = () =>
    modal(
      `<h2>${esc(state.work.title || "제목을 입력하세요")}</h2><div class="post-body">${esc(state.work.final || "최종 에세이를 작성하세요")}</div><h3 class="actions">작성 소감</h3><p>${esc(state.work.reflection)}</p>`,
    );
  $("#publish").onclick = (e) =>
    busy(e.currentTarget, async () => {
      await flush();
      await api("/posts", "POST");
      toast("우리 반 게시판에 글을 게시했습니다.");
      await loadPosts();
    });
  $("#unpublish").onclick = (e) =>
    busy(e.currentTarget, async () => {
      if (
        !confirm(
          "내 게시글과 댓글을 게시판에서 내릴까요? 글쓰기 기록은 남습니다.",
        )
      )
        return;
      await api("/posts", "DELETE");
      await loadPosts();
    });
  $("#refresh-posts").onclick = () => loadPosts();
  $("#post-search").oninput = () => renderPosts(state.posts || []);
  loadPosts();
}
async function loadPosts() {
  try {
    const d = await api(
      `/posts${state.me.role === "teacher" ? `?classId=${state.class.id}` : ""}`,
    );
    state.posts = d.posts;
    renderPosts(d.posts);
  } catch (e) {
    toast(e.message, true);
  }
}
function renderPosts(posts) {
  if (!$("#posts")) return;
  const openThreads = new Set(
    [...$("#posts").querySelectorAll("details[data-thread][open]")].map(
      (el) => el.dataset.thread,
    ),
  );
  const q = ($("#post-search")?.value || "").toLowerCase(),
    teacher = state.me.role === "teacher";
  const filtered = posts.filter((p) =>
    `${p.title} ${p.body} ${p.career} ${p.nickname}`.toLowerCase().includes(q),
  );
  $("#posts").innerHTML = filtered.length
    ? filtered
        .map(
          (p) =>
            `<article class="card post ${p.hidden ? "hidden-item" : ""}"><div class="post-meta"><span>${esc(p.nickname)}</span>${p.career ? `<span class="tag">${esc(p.career)}</span>` : ""}<span>${esc(new Date(p.created).toLocaleDateString("ko-KR"))}</span>${p.hidden ? '<span class="tag warn">숨김</span>' : ""}</div><h3>${esc(p.title)}</h3><div class="post-body">${esc(p.body)}</div><details><summary>작성 소감</summary><p class="post-body">${esc(p.reflection)}</p></details><details data-thread="${esc(p.id)}" ${openThreads.has(p.id) ? "open" : ""}><summary>댓글 ${p.comments.length}개 · 생각 나누기</summary>${p.comments.map((c) => `<div class="comment ${c.hidden ? "hidden-item" : ""}"><strong>${esc(c.nickname)}${c.hidden ? " · 숨김" : ""}</strong>${esc(c.body)}${teacher ? `<button class="text-button" data-moderate="${esc(c.id)}" data-type="comment" data-hidden="${c.hidden ? 0 : 1}">${c.hidden ? "댓글 다시 공개" : "댓글 숨김"}</button>` : ""}</div>`).join("")}${!teacher ? `<form data-comment="${esc(p.id)}"><label for="comment-${esc(p.id)}">의견과 질문 남기기</label><textarea id="comment-${esc(p.id)}" required maxlength="1500" rows="3" placeholder="설득력 있는 부분과 이유 / 더 알고 싶은 점 / 다른 관점"></textarea><button class="secondary actions">댓글 남기기</button></form>` : ""}</details>${teacher ? `<button class="text-button" data-moderate="${esc(p.id)}" data-type="post" data-hidden="${p.hidden ? 0 : 1}">${p.hidden ? "글 다시 공개" : "글 숨김"}</button>` : ""}</article>`,
        )
        .join("")
    : '<div class="empty">아직 게시된 에세이가 없거나 검색 결과가 없습니다.</div>';
  on("[data-comment]", "submit", (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      await api("/comments", "POST", {
        postId: e.target.dataset.comment,
        body: e.target.querySelector("textarea").value,
      });
      await loadPosts();
      toast("댓글을 남겼습니다.");
    });
  });
  on("[data-moderate]", "click", (e) =>
    busy(e.currentTarget, async () => {
      const b = e.currentTarget;
      await api(`/classes/${state.class.id}/moderate`, "POST", {
        id: b.dataset.moderate,
        type: b.dataset.type,
        hidden: b.dataset.hidden === "1",
      });
      await loadPosts();
    }),
  );
}
async function teacherAiSettings() {
  try {
    const setting = await api("/teacher-ai");
    modal(
      `<h2>학교 Google API 연결</h2><p class="muted">내 모든 수업에 적용됩니다. 학생은 API 키를 입력하지 않습니다.</p><div class="notice">${setting.local ? "교사 PC 로컬 설치 버전" : "공개 웹앱"} · ${setting.configured ? "키 저장됨 · 연결 테스트로 확인하세요" : "학교 API 등록 필요"}</div><form id="teacher-ai-form"><label for="ai-mode">이용 방식</label><select id="ai-mode"><option value="personal" ${setting.mode === "personal" ? "selected" : ""}>goedu.kr 학교 Google API 등록</option><option value="disabled" ${setting.mode === "disabled" ? "selected" : ""}>AI 사용 끄기</option></select><div id="personal-ai-fields"><p class="notice">학교 Google 계정(@goedu.kr)으로 <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener">Google AI Studio</a>에 로그인하고 Gemini API 키를 발급하세요. 일반 Gemini 로그인과 API 권한은 별개입니다.</p><label for="ai-school-email">학교 Google 이메일</label><input id="ai-school-email" type="email" maxlength="200" autocomplete="off" placeholder="teacher@goedu.kr" value="${esc(setting.schoolEmail)}"><p class="muted">이메일 형식만 확인합니다. API 키만으로 학교 계정 소유를 인증할 수 없으므로 발급 계정을 직접 확인하세요.</p><label for="ai-model">Gemini 모델</label><input id="ai-model" maxlength="90" value="${esc(setting.model)}"><p class="muted">권장 기본 모델: gemini-3.1-flash-lite. 다른 모델에서 503·응답 지연이 반복되면 이 모델로 변경해 설정을 저장하고 연결 테스트를 실행하세요.</p><label for="ai-token">학교 계정에서 발급한 Gemini API 키</label><input id="ai-token" type="password" maxlength="2000" autocomplete="new-password" placeholder="${setting.configured ? "변경할 때만 새 키를 입력하세요." : "발급한 API 키를 입력하세요."}"><p class="muted">키는 ${setting.local ? "이 컴퓨터" : "웹앱 서버"}의 데이터베이스에 암호화해 저장합니다. 학생이나 다른 교사에게 원문을 공개하지 않습니다.</p><label for="ai-limit">내 계정의 하루 분석 요청 한도</label><input id="ai-limit" type="number" min="1" max="1000" value="${setting.dailyLimit}"><div class="notice" id="ai-consent-notice"><b>필수: 자료 전송 동의</b><p>아래 항목을 직접 확인하고 체크해야 API 키를 저장할 수 있습니다. 저장 완료 후 연결 테스트를 실행하세요.</p></div><label class="check"><input id="ai-consent" type="checkbox"><span><b>[필수]</b> 내 수업의 공통 읽기 자료·희망 분야·에세이 초안·사진을 Google Gemini API로 전송하여 분석하고, 내 계정의 이용량에 포함되는 것을 확인했습니다.</span></label></div><div class="actions"><button type="submit">설정 저장</button><button type="button" id="test-ai" class="secondary" ${!setting.configured ? "disabled" : ""}>저장된 연결 테스트</button><button type="button" id="remove-ai" class="text-button">학교 API 연결 삭제</button></div></form><p id="ai-test-result" class="notice" role="status" aria-live="polite" hidden></p><a href="/ai-guide.html" target="_blank" rel="noopener">교사용 API 연결 안내 ↗</a><p class="muted">학교 계정의 API 이용 한도와 결제 정책이 적용됩니다. 연결 오류 시 다른 서비스로 자동 전환하지 않습니다.</p>`,
    );
    const showResult = (message, error = false) => {
      const result = $("#ai-test-result");
      result.hidden = false;
      result.className = `notice ${error ? "warn" : ""}`;
      result.textContent = message;
      result.scrollIntoView({ block: "nearest" });
    };
    const update = () => {
      const personal = $("#ai-mode").value === "personal";
      $("#personal-ai-fields").hidden = !personal;
      $("#ai-consent").required = personal;
      $("#ai-consent").disabled = !personal;
      $("#ai-school-email").required = personal;
      $("#ai-school-email").disabled = !personal;
    };
    update();
    $("#ai-mode").onchange = update;
    $("#ai-consent").oninvalid = () => {
      showResult("설정이 저장되지 않았습니다. ‘자료 전송 동의’의 [필수] 체크박스를 선택한 뒤 설정 저장을 눌러 주세요. API 키가 저장된 후 연결 테스트를 실행할 수 있습니다.", true);
    };
    $("#teacher-ai-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        try {
        const result = await api("/teacher-ai", "PUT", {
          mode: $("#ai-mode").value,
          provider: "google",
          model: $("#ai-model").value,
          schoolEmail: $("#ai-school-email").value,
          token: $("#ai-token").value,
          dailyLimit: Number($("#ai-limit").value),
          consent: $("#ai-consent").checked,
        });
        $("#ai-token").value = "";
        state.me.ai = result.available;
        toast("설정을 저장했습니다. 연결 테스트로 확인하세요.");
        await teacherAiSettings();
        if (result.configured) showResult("API 키가 저장되었습니다. ‘저장된 연결 테스트’를 눌러 Google API 연결을 확인하세요.");
        else showResult("AI 사용을 껐습니다.");
        } catch (error) {
          showResult(error.message, true);
        }
      });
    };
    $("#test-ai").onclick = (e) =>
      busy(e.currentTarget, async () => {
        if ($("#ai-token").value.trim()) {
          showResult("새로 입력한 API 키가 아직 저장되지 않았습니다. 자료 전송 동의를 확인하고 ‘설정 저장’을 먼저 눌러 주세요.", true);
          return;
        }
        try {
          const d = await api("/teacher-ai/test", "POST");
          showResult(d.message + " " + d.sample);
        } catch (error) {
          showResult(error.message, true);
        }
      });
    $("#remove-ai").onclick = (e) =>
      busy(e.currentTarget, async () => {
        if (
          !confirm(
            "학교 API 연결을 삭제하고 AI 사용을 끌까요?",
          )
        )
          return;
        const d = await api("/teacher-ai", "DELETE");
        state.me.ai = d.available;
        await teacherAiSettings();
        toast("개인 연결을 삭제했습니다.");
      });
  } catch (e) {
    toast(e.message, true);
  }
}

function teacherHome() {
  app.innerHTML = `<div class="workspace-header"><div><span class="eyebrow">TEACHER STUDIO</span><h1>질문이 자라는 수업을 만드세요.</h1><p class="muted">자료 준비부터 학생의 수정 과정까지, 수업별로 관리합니다.</p></div><div class="actions"><button id="my-ai-settings" class="secondary">내 AI 연결</button><button id="new-class">+ 새 수업 만들기</button></div></div>${!state.me.local ? `<div class="notice"><b>설치 없이 웹에서 수업하기</b><p>교사와 학생의 공통 접속 주소: <a href="${esc(location.origin)}">${esc(location.origin)}</a></p><p>새 수업을 만들고 8자리 수업 코드를 학생에게 알려 주세요. 학생은 이 주소에서 코드를 입력해 참여합니다.</p><a href="/classroom-guide.html" target="_blank" rel="noopener">웹 수업 사용 안내 ↗</a></div>` : ""}${!state.me.ai ? '<div class="notice warn">AI 연결이 꺼져 있거나 설정이 필요합니다. 내 AI 연결에서 이용 방식을 확인해 주세요.</div>' : ""}${state.me.local ? `<div class="notice"><b>교사 PC에서 실행 중</b><p>학생과 같은 학교망에서 사용하세요. 수업 중 이 컴퓨터를 켜 둡니다.</p>${(state.me.localAddresses || []).map((a) => `<p>${esc(a.label)} 학생 접속 주소: <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url)}</a></p>`).join("")}<a href="/local-guide.html" target="_blank" rel="noopener">학교 Google 계정 연결·로컬 설치 안내 ↗</a></div>` : ""}<div class="class-list">${state.me.classes.map((c) => `<div class="card"><span class="tag">${c.active ? "진행 중" : "종료됨"}</span><h3 class="actions">${esc(c.title)}</h3><p>참여 코드 <span class="code">${esc(c.code)}</span></p><button class="secondary full" data-class="${esc(c.id)}">수업 관리하기 →</button></div>`).join("") || '<div class="empty">첫 수업을 만들어 공통 읽기 자료를 준비해 보세요.</div>'}</div>`;
  $("#my-ai-settings").onclick = teacherAiSettings;
  $("#new-class").onclick = () => {
    modal(
      '<h2>새 수업 만들기</h2><form id="new-class-form"><label for="class-title">수업 이름</label><input id="class-title" maxlength="120" required placeholder="예: 1학년 진로 에세이 · 파주와 나"><button class="actions">수업 만들기</button></form>',
    );
    $("#new-class-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const c = await api("/classes", "POST", {
          title: $("#class-title").value,
        });
        $("#dialog").close();
        await openClass(c.id);
      });
    };
  };
  on("[data-class]", "click", (e) => openClass(e.currentTarget.dataset.class));
}
async function openClass(id) {
  try {
    state.class = await api(`/classes/${id}`);
    state.tab = "material";
    await teacherScreen();
  } catch (e) {
    toast(e.message, true);
  }
}
async function teacherScreen() {
  const c = state.class;
  app.innerHTML = `<button id="all-classes" class="text-button">← 내 수업 목록</button><div class="workspace-header"><div><span class="eyebrow">CLASSROOM MANAGEMENT</span><h1>${esc(c.title)}</h1><p>참여 코드 <span class="code">${esc(c.code)}</span> · ${c.active ? "수업 진행 중" : "종료된 수업"}</p></div><div class="actions"><button id="my-ai-settings" class="secondary">내 AI 연결</button><button id="copy-code" class="secondary">수업 코드 복사</button><button id="copy-link" class="secondary">학생 참여 링크 복사</button><button id="export" class="secondary">활동 기록 Excel 다운로드</button></div></div><nav class="tabs teacher-tabs"><button data-tab="material" class="${state.tab === "material" ? "active" : ""}">공통 자료 준비</button><button data-tab="students" class="${state.tab === "students" ? "active" : ""}">학생 진행 현황</button><button data-tab="board" class="${state.tab === "board" ? "active" : ""}">에세이 · 댓글</button><button data-tab="settings" class="${state.tab === "settings" ? "active" : ""}">수업 관리</button></nav><div id="teacher-content"></div>`;
  $("#all-classes").onclick = () => loadMe();
  $("#my-ai-settings").onclick = teacherAiSettings;
  $("#copy-code").onclick = async () => {
    try { await navigator.clipboard.writeText(c.code); toast("수업 코드를 복사했습니다. 학생은 같은 웹주소에서 이 코드를 입력하면 됩니다."); }
    catch { modal(`<h2>학생에게 알려 줄 수업 코드</h2><input readonly value="${esc(c.code)}"><p>학생은 같은 웹주소의 첫 화면에서 이 코드를 입력합니다.</p>`); }
  };
  $("#copy-link").onclick = async () => {
    const link = `${state.me.localBaseURL || location.origin}/?class=${c.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("학생 참여 링크를 복사했습니다.");
    } catch {
      modal(
        `<h2>학생 참여 링크</h2><input readonly value="${esc(link)}"><p>링크를 복사해 학생에게 공유하세요.</p>`,
      );
    }
  };
  $("#export").onclick = (e) =>
    busy(e.currentTarget, async () => {
      const record = await api(`/classes/${c.id}/export`);
      const blob = new Blob([exportRecordsXlsx(record)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `학생활동기록-${c.code}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Excel 기록을 내려받았습니다. 파일은 편집 가능하며 웹앱에 자동 반영되지는 않습니다.");
    });
  on("[data-tab]", "click", (e) => {
    state.tab = e.currentTarget.dataset.tab;
    teacherScreen();
  });
  if (state.tab === "material") teacherMaterial();
  if (state.tab === "students") await teacherStudents();
  if (state.tab === "board") {
    $("#teacher-content").innerHTML =
      '<h3>학급 게시판 관리</h3><p class="muted">게시글과 댓글을 확인하고 숨기거나 다시 공개할 수 있습니다.</p><input id="post-search" class="search" aria-label="게시글 검색" placeholder="제목 · 분야 · 별명 검색"><div id="posts"></div>';
    $("#post-search").oninput = () => renderPosts(state.posts || []);
    await loadPosts();
  }
  if (state.tab === "settings") teacherSettings();
}
function teacherMaterial() {
  const m = state.class.material;
  $("#teacher-content").innerHTML =
    `<div class="two-col"><div class="card"><h3>01. 읽기 자료 후보 준비</h3><label for="paju">파주 지역 탐구 소재</label><select id="paju"><option value="">소재를 선택하세요</option>${materials.map((m, i) => `<option value="${i}">${esc(m.title)}</option>`).join("")}</select><button id="use-paju" class="secondary actions">선택한 탐구 글 불러오기</button><div class="notice">파주와 연결한 자체 작성 탐구 글입니다. 특정 지역 통계나 사건을 설명하는 자료가 아니며, 수업 목적에 맞게 검토·수정하세요.</div><label for="keyword">교사 키워드</label><input id="keyword" maxlength="300" placeholder="예: 파주, 평화, 생태, 교육"><div class="actions"><button id="generate">AI 읽기 자료 만들기</button><button id="find-books" class="secondary">관련 책 찾기</button></div><div id="books"></div><p class="muted">도서는 Open Library의 실제 검색 결과를 제공합니다. 한국어 검색 결과가 적으면 영어 키워드도 시도하세요. 책을 선택하면 소개용 서지 정보를 불러옵니다. 본문 발췌는 교사가 별도로 준비합니다.</p></div><form class="card" id="material-form"><h3>02. 검토하고 학급 자료 확정</h3><label for="m-title">자료 제목</label><input id="m-title" required maxlength="200" value="${esc(m.title)}"><label for="m-body">공통 읽기 자료 · 직접 등록 / 편집 가능</label><textarea id="m-body" required maxlength="15000" rows="15" placeholder="AI 글, 직접 준비한 글, 책 소개와 읽기 안내를 입력하세요.">${esc(m.body)}</textarea><label for="m-source">출처와 읽기 안내</label><input id="m-source" maxlength="1000" value="${esc(m.source)}" placeholder="출처, URL, 책 정보, 생성 자료 여부"><label class="check"><input type="checkbox" required>내용의 정확성·출처·수업 적합성을 검토했습니다.</label><button class="actions full">학급 공통 읽기 자료로 확정</button></form></div>`;
  let type = m.type || "teacher";
  $("#m-body").addEventListener("input", () => {
    if (type !== "ai" && type !== "paju" && type !== "book") type = "teacher";
  });
  $("#use-paju").onclick = () => {
    if ($("#paju").value === "") {
      toast("소재를 선택하세요.", true);
      return;
    }
    const m = materials[Number($("#paju").value)];
    $("#m-title").value = m.title;
    $("#m-body").value = m.body;
    $("#m-source").value = m.source;
    type = m.type;
  };
  $("#generate").onclick = (e) =>
    busy(e.currentTarget, async () => {
      const d = await api(`/classes/${state.class.id}/generate`, "POST", {
        keyword: $("#keyword").value,
      });
      $("#m-title").value = d.text
        .split("\n")[0]
        .replace(/^#+\s*/, "")
        .slice(0, 200);
      $("#m-body").value = d.text;
      $("#m-source").value = "AI 생성 읽기 자료 · 교사 검토 필요";
      type = "ai";
      toast("생성 자료를 검토하고 학급 자료로 확정하세요.");
    });
  $("#find-books").onclick = (e) =>
    busy(e.currentTarget, async () => {
      const d = await api(`/classes/${state.class.id}/books`, "POST", {
        keyword: $("#keyword").value,
      });
      $("#books").innerHTML = d.books.length
        ? d.books
            .map(
              (b, i) =>
                `<div class="book"><b>${esc(b.title)}</b><small>${esc(b.author)} · ${esc(b.year)}</small><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">도서 정보 확인 ↗</a><br><button class="secondary" data-book="${i}">소개 자료로 불러오기</button></div>`,
            )
            .join("")
        : '<div class="notice">검색된 도서가 없습니다. 키워드를 바꿔 보세요.</div>';
      on("[data-book]", "click", (e) => {
        const b = d.books[Number(e.currentTarget.dataset.book)];
        $("#m-title").value = b.title.slice(0, 200);
        $("#m-body").value =
          `관련 도서: ${b.title}\n저자: ${b.author}\n첫 출판 연도: ${b.year}\n\n[교사 작성] 이 책을 읽을 이유, 수업에서 읽을 범위, 함께 생각할 질문을 보완해 주세요.\n\n도서 정보: ${b.url}`;
        $("#m-source").value = `Open Library 서지 검색 · ${b.url}`;
        type = "book";
      });
    });
  $("#material-form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const material = {
        title: $("#m-title").value,
        body: $("#m-body").value,
        source: $("#m-source").value,
        type,
      };
      await api(`/classes/${state.class.id}/material`, "PUT", material);
      state.class.material = material;
      toast("학급 공통 읽기 자료를 확정했습니다.");
    });
  };
}
async function teacherStudents() {
  const d = await api(`/classes/${state.class.id}/students`);
  state.students = d.students;
  const students = d.students,
    count = (k) => students.filter((s) => s.data[k]).length;
  $("#teacher-content").innerHTML =
    `<div class="stat-grid"><div class="stat"><strong>${students.length}</strong><span>참여 학생</span></div><div class="stat"><strong>${count("topic")}</strong><span>중심 질문 작성</span></div><div class="stat"><strong>${count("draft")}</strong><span>초안 작성</span></div><div class="stat"><strong>${count("final")}</strong><span>최종본 작성</span></div></div><div class="card"><div class="help-row"><h3>학생별 글쓰기 과정</h3><button id="refresh-students" class="secondary">새로고침</button></div><div class="table-wrap"><table><thead><tr><th>별명</th><th>관심 분야</th><th>중심 질문</th><th>읽기</th><th>초안</th><th>수정 기록</th><th>최종본</th><th>기록</th></tr></thead><tbody>${students.map((s, i) => `<tr><td>${esc(s.nickname)}</td><td>${esc(s.data.career || "—")}</td><td><div class="topic-cell">${esc(s.data.topic || "—")}</div></td>${["memo", "draft", "revision", "final"].map((k) => `<td>${s.data[k] ? '<span class="pill">작성</span>' : "—"}</td>`).join("")}<td><button class="text-button" data-student="${i}">자세히 보기</button></td></tr>`).join("")}</tbody></table></div>${students.length ? "" : '<div class="empty">학생 참여 링크를 공유하면 이곳에서 진행 상황을 확인할 수 있습니다.</div>'}</div>`;
  $("#refresh-students").onclick = () =>
    busy($("#refresh-students"), () => teacherStudents());
  on("[data-student]", "click", (e) =>
    studentDetail(students[Number(e.currentTarget.dataset.student)]),
  );
}
function studentDetail(s) {
  const labels = {
    memo: "읽기 메모",
    career: "관심 분야",
    topic: "중심 질문",
    claim: "잠정 주장과 선택 이유",
    outline: "글쓰기 개요",
    comparison: "다른 분야의 관점",
    draft: "초안",
    revision: "피드백 반영 기록",
    rejection: "논리적 거절 사유서",
    keywords: "진로 연결 키워드",
    final: "최종 에세이",
    reflection: "소감과 성찰",
    aiDisclosure: "AI 활용 내역",
  };
  modal(
    `<h2>${esc(s.nickname)}님의 글쓰기 기록</h2><p class="muted">마지막 저장 ${s.updated ? esc(new Date(s.updated).toLocaleString("ko-KR")) : "아직 기록 없음"}</p>${Object.entries(
      labels,
    )
      .map(
        ([k, l]) =>
          `<details ${["topic", "draft", "revision", "final"].includes(k) ? "open" : ""}><summary>${l}</summary><div class="ai-output">${esc(s.data[k] || "아직 작성하지 않았습니다.")}</div></details>`,
      )
      .join(
        "",
      )}<h3 class="actions">AI 피드백과 분석 당시 초안</h3>${s.feedback.map((f) => `<details><summary>${esc(new Date(f.created).toLocaleString("ko-KR"))}</summary><div class="ai-output">${esc(f.content)}</div><div class="reading">${esc(f.draft)}</div></details>`).join("") || '<p class="muted">피드백 기록이 없습니다.</p>'}<div class="danger-zone"><button id="reset-student" class="secondary">학생 비밀번호 초기화</button><p class="muted">초기화한 비밀번호는 해당 학생에게만 전달하세요.</p></div>`,
  );
  $("#reset-student").onclick = (e) =>
    busy(e.currentTarget, async () => {
      if (
        !confirm("학생 비밀번호를 초기화할까요? 기존 로그인 세션도 해제됩니다.")
      )
        return;
      const d = await api(`/classes/${state.class.id}/reset`, "POST", {
        studentId: s.id,
      });
      modal(
        `<h2>임시 비밀번호</h2><p>${esc(s.nickname)} 학생에게만 전달하세요.</p><div class="recover-note">${esc(d.password)}</div>`,
      );
    });
}
function teacherSettings() {
  $("#teacher-content").innerHTML =
    `<div class="card"><h3>수업 참여와 작성 관리</h3><p>수업을 종료하면 신규 참여, 글 작성, AI 분석, 게시와 댓글 작성을 막습니다. 기존 참여자는 기록을 열람할 수 있습니다.</p><button id="toggle-class" class="secondary">${state.class.active ? "수업 종료하기" : "수업 다시 열기"}</button><div class="danger-zone"><h3>수업과 학생 기록 삭제</h3><p>읽기 자료, 학생 계정, 초안, 피드백, 게시글과 댓글이 모두 삭제됩니다. 먼저 기록을 내려받으세요.</p><button id="delete-class" class="danger">이 수업 전체 삭제</button></div></div>`;
  $("#toggle-class").onclick = (e) =>
    busy(e.currentTarget, async () => {
      await api(`/classes/${state.class.id}`, "PUT", {
        active: !state.class.active,
      });
      state.class.active = !state.class.active;
      teacherScreen();
    });
  $("#delete-class").onclick = (e) =>
    busy(e.currentTarget, async () => {
      if (
        prompt("삭제하려면 수업 코드를 입력하세요. 모든 기록이 삭제됩니다.") !==
        state.class.code
      )
        return;
      await api(`/classes/${state.class.id}`, "DELETE");
      toast("수업과 관련 기록을 삭제했습니다.");
      await loadMe();
    });
}
window.addEventListener("beforeunload", (e) => {
  if (
    state.me?.role === "student" &&
    $(".save-status")?.textContent !== "서버에 저장됨"
  ) {
    e.preventDefault();
    e.returnValue = "";
  }
});
try {
  await loadMe();
} catch (e) {
  account();
  if (new URLSearchParams(location.search).has("class"))
    auth("student", "register");
  else home();
  if (!e.message.includes("로그인") && !e.message.includes("다시 로그인"))
    toast(e.message, true);
}

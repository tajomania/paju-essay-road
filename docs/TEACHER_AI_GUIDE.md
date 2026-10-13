# 교사용 학교 Google API 연결 안내

공개 웹앱과 Windows 로컬 버전 모두 **goedu.kr 학교 Google 계정에서 발급한 Gemini API 키**를 등록해 이용합니다. 공용 AI와 개인 Cloudflare AI 연결은 제공하지 않습니다. 기존 연결은 비활성화되므로 새로 등록하세요. 학생은 주소와 참여 코드만 사용합니다.

## 등록 절차

1. [Google AI Studio](https://aistudio.google.com/api-keys)에 자신의 **@goedu.kr 학교 Google 계정**으로 로그인합니다.
2. 학교 계정의 프로젝트에서 Gemini API 키를 발급합니다.
3. 웹앱에서 교사 로그인 후 **내 AI 연결**을 누릅니다.
4. **goedu.kr 학교 Google API 등록**을 선택하고 학교 이메일·API 키·모델 이름을 입력합니다. 기본 모델은 `gemini-3.5-flash-lite`입니다.
5. 하루 요청 한도와 전송 자료 안내를 확인하고 **설정 저장**을 누릅니다.
6. **저장된 연결 테스트**가 성공하는지 확인한 뒤 학생에게 수업 링크를 공유합니다.

일반 Gemini 웹 로그인과 API 사용 권한은 별개입니다. 학교 관리자가 AI Studio·프로젝트·API 키 발급을 제한할 수 있습니다. [Google 공식 계정 안내](https://ai.google.dev/gemini-api/docs/workspace), [API 키 안내](https://ai.google.dev/gemini-api/docs/api-key).

앱은 입력 이메일의 `@goedu.kr` 형식을 확인합니다. Google OAuth 로그인이나 학교 계정 소유 인증을 제공하지 않으며, API 키만으로 발급 계정을 확인할 수 없습니다. AI Studio에서 발급 계정을 직접 확인하세요.

## 저장과 학생 자료

키는 로컬 버전에서는 교사 PC, 공개 버전에서는 웹앱 서버에 암호화해 저장합니다. 학생과 다른 교사는 키 원문을 볼 수 없습니다. 로컬 설정 변경은 교사 PC의 localhost 화면에서만 가능합니다. 이메일은 교사 AI 설정에만 사용하며 학생에게 표시하지 않습니다.

AI 요청 시 공통 읽기 자료·희망 분야·에세이 초안·사진이 **Google Gemini API**로 전송됩니다. 사진 원본은 앱 서버에 보관하지 않습니다. 학생이 직접 쓴 글에 피드백을 제공하며 에세이를 대신 작성하는 기능은 제공하지 않습니다.

학교 API 계정의 이용량·결제 정책이 적용됩니다. 앱의 요청 한도는 금액 한도가 아닙니다. 연결 실패 시 다른 AI로 자동 전환하지 않습니다. 연결 삭제 또는 AI 사용 끄기는 저장된 키를 삭제하며, Google에서 키를 폐기하려면 AI Studio에서도 처리하세요. 실제 학교 계정 연결은 해당 교사의 키로 테스트해야 확인할 수 있습니다.

## 로컬 설치

[Windows 패키지](https://github.com/tajomania/paju-essay-road/releases/download/v1.1.1/Paju-Essay-Road-Windows.zip)를 전체 압축 해제하고 **Start-Classroom.cmd**를 실행하세요. 자세한 설치와 학생 학교망 접속 방법은 [로컬 설치 안내](LOCAL_GOOGLE_GUIDE.md)를 따릅니다. 로컬 학생 접속용 학교망 IP 주소는 AI 제공사 연결과 별개이며 계속 필요합니다.

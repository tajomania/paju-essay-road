# 교사용 AI 연결 안내

웹앱 주소: https://paju-essay-road.essay-road.workers.dev

화면 안내문: https://paju-essay-road.essay-road.workers.dev/ai-guide.html

## 시작하기

교사로 로그인하고 **내 AI 연결**을 누릅니다. 설정은 해당 교사의 모든 수업에 적용됩니다. 학생은 별도 키 없이 참여 링크와 수업 코드로 이용합니다.

- 공용 Cloudflare AI: 운영자의 공용 한도 내에서 키 없이 이용합니다.
- 내 Cloudflare 계정: 자신의 Account ID·Workers AI API 토큰을 저장합니다. 자신의 계정 이용량으로 분석합니다.
- AI 사용 끄기: 직접 읽기·쓰기·공유 활동은 계속 가능합니다.

## 개인 Cloudflare 연결

1. Cloudflare 가입과 이메일 인증을 완료합니다.
2. 대시보드의 Workers AI → Use REST API를 엽니다.
3. Create a Workers AI API Token에서 토큰을 생성하고 복사합니다.
4. Get Account ID에서 Account ID를 복사합니다.
5. 웹앱의 내 AI 연결에서 개인 계정 방식을 선택하고 두 값을 입력합니다.
6. 하루 요청 한도와 자료 전송 안내를 확인하고 저장합니다.
7. 저장된 연결 테스트를 눌러 성공을 확인합니다. 테스트는 학생 글을 사용하지 않습니다.

수동 토큰 설정에는 Workers AI - Read와 Workers AI - Edit 권한이 필요합니다. [Cloudflare 공식 안내](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)를 참고하세요. 토큰은 서버에 암호화해 저장하고 원문을 다시 표시하지 않습니다. 다른 교사·학생과 공유하거나 공개 문서에 올리지 마세요.

## 학생에게 안내할 내용

분석할 때 공통 읽기 자료·희망 분야·에세이 초안·사진이 Cloudflare Workers AI로 전송됩니다. 사진 원본은 앱 서버에 보관하지 않으며, 인식 결과·글쓰기 기록·피드백은 수업 기록으로 저장합니다. 학생은 초안 글자를 확인하고 AI의 제안을 자신의 근거에 따라 수용하거나 거절합니다. AI는 에세이를 대신 쓰는 기능으로 제공하지 않습니다.

## 비용·문제 해결·해제

개인 계정은 해당 교사의 Cloudflare 이용량과 결제 정책이 적용됩니다. 요청 한도는 금액 한도가 아니며 실제 비용은 제공사에서 확인합니다. 개인 연결 실패 시 공용 계정으로 자동 전환하지 않습니다.

인증 오류는 계정과 토큰 권한을 확인하고, 한도 오류는 계정 이용량을 확인합니다. 사진 인식 오류는 선명한 사진을 다시 등록하거나 텍스트를 직접 수정합니다. 개인 연결 삭제 또는 공용 전환은 저장된 개인 토큰을 삭제합니다. 토큰 폐기가 필요하면 Cloudflare에서도 처리하세요.

## 학교 Google 계정과 로컬 컴퓨터

학교 Google 계정의 Gemini API 키를 사용하려면 Windows 로컬 실행 패키지를 설치하고 [로컬 설치 안내](LOCAL_GOOGLE_GUIDE.md)를 따릅니다. 공개 웹앱의 Google 연결은 허용하지 않고 로컬 버전에서만 키를 설정합니다.

# 운영자용 GitHub 배포 안내
현재 공개 주소: https://paju-essay-road.essay-road.workers.dev

현재 GitHub 저장소: https://github.com/tajomania/paju-essay-road

AI는 교사별 goedu.kr 학교 Google Gemini API 등록으로만 이용합니다. Cloudflare는 앱과 데이터 저장 서버로 사용합니다.


배포 운영자만 이 설정을 수행합니다. 다른 교사와 학생은 완성된 웹앱 주소로 접속합니다. 이 문서는 현재 배포 완료를 뜻하지 않으며, 실제 배포 URL은 GitHub Actions/Cloudflare가 성공한 뒤 확인합니다.

## 1. 준비할 계정

- GitHub: 소스 저장소 및 자동 배포
- Cloudflare: 웹앱 서버와 D1 데이터베이스
- AI: 교사별 학교 Google Gemini API. 제공사 이용량 한도와 비용 정책을 확인합니다.

일반 ChatGPT 구독만으로 API 연결이 완료되지는 않습니다. 운영자는 API 키를 서버 비밀값으로 설정합니다. 학생과 수업을 배포받는 교사에게는 키를 요구하지 않습니다.

## 2. GitHub 저장소

이 프로젝트 폴더 전체를 `paju-essay-road` 등의 새 저장소에 올립니다. 저장소 루트에 `package.json`, `wrangler.jsonc`, `public/`, `src/`, `migrations/`, `.github/`가 있어야 합니다. 상위 작업 폴더에 있는 다른 앱을 함께 올리지 않습니다. `node_modules`, `.wrangler`, `.dev.vars`, 테스트 화면 기록은 올리지 않습니다.

GitHub CLI로 업로드하는 경우:

```sh
gh auth login
git init -b main
git add .
git commit -m "Build Paju career essay classroom app"
gh repo create paju-essay-road --public --source=. --remote=origin --push
```

공개 저장소라도 학생 기록과 AI 키는 소스에 없으며 서버에서만 관리됩니다. 필요에 따라 소스 저장소는 비공개로 운영해도 웹앱 자체는 주소로 이용할 수 있습니다.

## 3. Cloudflare에 데이터베이스 생성

Cloudflare 대시보드의 **Storage & databases → D1**에서 `essay-road` 데이터베이스를 만듭니다. 생성 후 Database ID(UUID)를 복사합니다. 새 운영 환경은 `wrangler.jsonc`의 database_id를 자신의 데이터베이스 ID로 교체합니다.

Cloudflare Account ID를 확인하고, API Token을 만듭니다. 해당 계정의 **Workers Scripts: Edit**, **D1: Edit**, **Account Settings: Read** 권한을 사용합니다. 가능한 해당 계정으로 범위를 제한합니다. 토큰은 채팅이나 소스 파일에 적지 않습니다.

## 4. GitHub Actions 설정

저장소 **Settings → Secrets and variables → Actions**에 등록합니다.

| 구분 | 이름 | 값 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | 생성한 Cloudflare API 토큰 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| Variable | `D1_DATABASE_ID` | 실제 D1 Database ID |
| Variable | `WORKER_NAME` | 선택 입력. 미입력 시 `paju-essay-road` |
| Variable | `DEPLOY_ENABLED` | `true` |

저장소에 `production` 환경이 없다면 Actions가 환경을 생성합니다. 조직 정책에 따라 환경 승인이 필요할 수 있습니다. Actions 탭에서 **Deploy essay road → Run workflow**를 실행합니다.

자동 배포는 검사 → 설정 주입 → D1 마이그레이션 → Worker와 정적 파일 배포 순서입니다. 학생 데이터를 삭제하는 초기화 명령은 실행하지 않습니다.

## 5. 승인 후 AI 연결 활성화

교사별 Gemini API 키를 암호화할 `AI_KEY_ENCRYPTION_SECRET`을 Worker Secret으로 설정합니다. 충분히 긴 난수를 사용하고 소스에 커밋하지 않습니다. 기존 운영 환경의 암호화 비밀값을 교체하지 마세요. `AI_ENABLED=true`로 등록 기능을 활성화합니다. 운영자 공용 키 또는 AI 바인딩은 사용하지 않습니다. 교사가 앱에서 학교 이메일·Gemini API 키를 등록하고 연결 테스트를 수행합니다. 상세 절차는 [교사 안내](TEACHER_AI_GUIDE.md)를 따릅니다.

## 6. 배포 결과 확인

Actions 로그의 배포 성공과 `https://…workers.dev` URL을 확인합니다. 브라우저에서 다음을 실제로 점검합니다.

1. 교사 가입 → 복구 코드 보관 → 새 수업 생성
2. 공통 자료 준비 → 검토 → 확정
3. 다른 기기에서 학생 참여 링크로 가입
4. 읽기 메모와 주제를 저장하고 재접속해 복원 확인
5. 실제 사진 문자 인식 → 학생 텍스트 확인 → AI 피드백
6. 최종 글 게시 → 다른 학생 댓글 → 교사 진행 현황 확인
7. 별개의 교사와 수업에서 다른 학급 데이터가 보이지 않는지 확인

`/api/health`는 서버와 AI 키 설정 유무를 알려주지만 AI API 키의 유효성까지 검증하지는 않습니다. 실제 AI 요청이 성공해야 연결을 확인한 것입니다.

완성된 **앱의 기본 URL**을 다른 교사에게 배포합니다. 교사는 자기 수업을 생성하고 **학생 참여 링크**를 학생에게 공유합니다. 교사 관리용 로그인 정보는 공유하지 않습니다.

## 변경 배포와 기록 관리

DEPLOY_ENABLED=true와 배포 토큰이 설정된 경우 main 브랜치 변경을 자동 배포합니다. 현재 공개 배포는 운영자의 Wrangler 연결로 수행하며 GitHub 자동 배포는 토큰 설정 후 활성화할 수 있습니다. 학생 데이터는 소스 저장소와 별개입니다. 교사는 수업 관리 화면에서 기록을 내려받고 필요 시 수업을 종료하거나 삭제합니다. 운영자는 Cloudflare D1 백업·복원 설정과 API 결제·사용량을 관리합니다.

GitHub Pages에 `public/`만 배포하면 화면 파일은 열리더라도 `/api/` 서버가 없어 수업 참여·공유·AI는 작동하지 않습니다. 이 앱은 전체 Worker 배포를 사용해야 합니다.

## 교사별 토큰 암호화

개인 토큰을 저장하려면 AI_KEY_ENCRYPTION_SECRET을 Worker Secret으로 설정합니다. 현재 운영 서버에는 이미 등록했습니다. 암호화는 교사 ID를 추가 인증 데이터로 사용하는 AES-GCM입니다. 비밀값을 임의로 교체하면 기존 개인 토큰을 읽을 수 없으므로, 키 변경 시 교사 재연결 또는 별도 재암호화 절차가 필요합니다. 이 비밀값을 소스에 커밋하지 않습니다.

교사 개인 연결의 일일 한도는 같은 교사의 모든 수업 분석 요청을 합산합니다. 연결 테스트는 별도 하루 8회 한도이며 제공사 이용량에는 포함될 수 있습니다. 개인 토큰과 Account ID는 글쓰기 기록 내보내기에 포함하지 않습니다.

## Gemini API와 실행 위치

Google이 `REGION_UNSUPPORTED`를 반환한 경우 API 키·모델 오류와 구분합니다. 현재 공개 웹앱은 사용자의 승인에 따라 `placement.region = "gcp:asia-northeast3"`로 서울 인근 Cloudflare 실행 배치를 사용합니다. 이는 근접 실행 배치 힌트이며 D1 데이터베이스의 저장 위치를 옮기는 설정은 아닙니다. 배치 적용 후 기존 교사 계정의 저장된 Gemini API 키로 웹 연결 테스트 성공을 확인했습니다. 다른 운영 환경에서는 Google 지원 지역과 서버 배치를 확인하세요.

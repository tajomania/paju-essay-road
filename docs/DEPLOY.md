# 운영자용 GitHub 배포 안내
현재 공개 주소: https://paju-essay-road.essay-road.workers.dev

현재 GitHub 저장소: https://github.com/tajomania/paju-essay-road

현재 배포는 AI_ENABLED=false이며, 외부 AI 전송은 승인 대기 상태입니다. Cloudflare 내장 AI 연결 코드와 OpenAI 선택 연결 코드는 준비되어 있지만 아직 실제 AI 분석이 활성화된 것은 아닙니다.


배포 운영자만 이 설정을 수행합니다. 다른 교사와 학생은 완성된 웹앱 주소로 접속합니다. 이 문서는 현재 배포 완료를 뜻하지 않으며, 실제 배포 URL은 GitHub Actions/Cloudflare가 성공한 뒤 확인합니다.

## 1. 준비할 계정

- GitHub: 소스 저장소 및 자동 배포
- Cloudflare: 웹앱 서버와 D1 데이터베이스
- AI: Cloudflare Workers AI 내장 연결 또는 선택적으로 OpenAI API. 제공사 이용량 한도와 비용 정책을 확인합니다.

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

Cloudflare 대시보드의 **Storage & databases → D1**에서 `essay-road` 데이터베이스를 만듭니다. 생성 후 Database ID(UUID)를 복사합니다. `wrangler.jsonc`의 0으로 된 ID는 로컬 실행용 임시값이며 실제 데이터베이스가 아닙니다.

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

현재 AI_ENABLED=false로 외부 AI 전송이 차단되어 있습니다. 학생의 읽기 자료·관심 분야·초안·사진을 외부 AI에 전송하는 운영 방식이 승인된 후에만 활성화합니다.

Cloudflare 내장 AI를 사용할 때는 wrangler.jsonc에 ai: {binding: "AI"}를 추가하고 vars의 AI_ENABLED를 "true", CLOUDFLARE_AI_MODEL을 "@cf/qwen/qwen3.8-27b"로 설정해 배포합니다. 키 입력은 필요 없지만 Workers AI 사용량과 계정 한도가 적용됩니다.

OpenAI를 사용할 경우 첫 배포 성공 후 Cloudflare의 생성된 Worker → **Settings → Variables and Secrets**에 다음 값을 추가합니다.

| 이름 | 형식 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | Secret, OpenAI 사용 시 | 운영자 OpenAI API 키 |
| `AI_ENABLED` | 변수 | 승인 이후에만 true |
| `TEACHER_INVITE_CODE` | Secret, 선택 | 설정하면 교사 가입 시 초대 코드 필요 |

Cloudflare에서 비밀값을 저장하고 새 배포에 적용합니다. 키는 GitHub에 커밋하지 않습니다. `OPENAI_MODEL` 기본값은 `gpt-4.1-mini`이며 운영자의 API 계정에서 사용 가능한 이미지 입력 모델로 조정할 수 있습니다. `store:false` 요청을 사용하지만 제공사의 데이터 처리 정책은 별도로 적용됩니다.

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

main 브랜치에 소스 변경을 올리면 자동 배포됩니다. 학생 데이터는 소스 저장소와 별개입니다. 교사는 수업 관리 화면에서 기록을 내려받고 필요 시 수업을 종료하거나 삭제합니다. 운영자는 Cloudflare D1 백업·복원 설정과 API 결제·사용량을 관리합니다.

GitHub Pages에 `public/`만 배포하면 화면 파일은 열리더라도 `/api/` 서버가 없어 수업 참여·공유·AI는 작동하지 않습니다. 이 앱은 전체 Worker 배포를 사용해야 합니다.

# 스테이징 외부 체험 운영 런북

작성일: 2026-06-05

이 문서는 더이음 전자결재 앱을 30명 안팎 외부 체험자에게 열기 위한 운영자용 절차다. 이 환경은 정식 운영 환경이 아니며 실제 개인정보와 실제 영수증을 넣지 않는다. 체험자에게도 real 개인정보/real receipts 사용 금지를 명확히 공지한다.

## 1. 준비물

- Linux 서버 또는 Docker Compose를 실행할 수 있는 VM
- HTTPS로 접근 가능한 도메인
- Docker와 Docker Compose plugin
- 배포 대상 커밋: `56feb60` 이후 Task 18 변경을 포함한 커밋
- 체험 담당 관리자 계정
- 체험자별 계정 전달 채널

## 2. 서버 파일 준비

```bash
git clone git@github.com:5240KYH/Theieum-app.git theieum
cd theieum
cp .env.staging.example .env.staging
```

`.env.staging`에서 아래 값을 반드시 교체한다.

```dotenv
DB_PASSWORD=replace-with-generated-db-password
JWT_SECRET=replace-with-generated-jwt-secret
STAGING_PUBLIC_URL=https://approval-staging.example.com
ATTACHMENT_MAX_IMAGE_BYTES=5242880
ATTACHMENT_MAX_FILES_PER_APPLICATION=10
```

`DB_PASSWORD`와 `JWT_SECRET`은 예시값이 아닌 서로 다른 긴 난수 문자열을 사용한다. `STAGING_PUBLIC_URL`은 체험자가 실제로 접속할 HTTPS URL로 맞춘다. 첨부파일 기본 정책은 신청서당 영수증 이미지 최대 10개, 파일당 5MB 이하이며, 변경이 필요하면 [스테이징 체험 계정과 첨부파일 관리 런북](staging-trial-data-and-attachments.md)을 먼저 확인한다.

## 3. Compose 정적 검증

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml config
```

아래 항목을 확인한다.

- `postgres`에 `ports:`가 없다.
- `backend`에 `ports:`가 없다.
- `frontend`만 외부 공개 포트를 연다.
- `JWT_SECRET`과 `DB_PASSWORD`가 `.env.staging.example`의 예시 문자열이 아니다.

## 4. 최초 기동

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
```

`postgres`, `backend`, `frontend`가 모두 running 상태인지 확인한다. 백엔드가 반복 재시작되면 먼저 `.env.staging`의 secret 값과 DB 연결 값을 확인한다.

## 5. HTTPS 앞단

서버 앞단의 Caddy, nginx+certbot, Cloudflare Tunnel, 또는 배포 플랫폼 HTTPS 기능으로 `STAGING_PUBLIC_URL`을 `frontend` 컨테이너의 80 포트로 연결한다.

확인 명령:

```bash
curl -I https://approval-staging.example.com
curl -I https://approval-staging.example.com/manifest.webmanifest
```

두 요청 모두 `HTTP/2 200` 또는 `HTTP/1.1 200`을 반환해야 한다. 리다이렉트가 있다면 최종 URL이 HTTPS이고 체험자에게 전달한 URL과 일치하는지 확인한다.

## 6. 스모크 검증

서버 루트에서 shell smoke를 실행한다.

```bash
scripts/staging-smoke.sh https://approval-staging.example.com
```

E2E smoke는 `e2e` 디렉터리에서 실행한다.

```bash
cd e2e
E2E_BASE_URL=https://approval-staging.example.com npm run test -- mobile-pwa-staging.spec.ts
```

두 검증이 모두 통과한 뒤에만 체험 URL을 배포한다.

## 7. 체험 시작 전 데이터 점검

- 관리자 계정으로 로그인한다.
- 사용자, 조직, 직위, 기본 결재선, 조직별 예외 결재자를 확인한다.
- 30명 안팎 계정 배정은 [스테이징 체험 계정과 첨부파일 관리 런북](staging-trial-data-and-attachments.md)의 계정 풀을 기준으로 준비한다.
- 조직별 예외 결재자가 필요한 부서에 빠지지 않았는지 확인한다.
- 체험자에게 배정할 계정이 모두 활성 상태인지 확인한다.
- 외부 체험자는 가능하면 개인별 계정으로 배정한다.
- 공유 seed 계정을 여러 명에게 전달하지 않는다. 첫 사용자의 비밀번호 변경으로 다음 체험자가 잠길 수 있다.
- 매니저 시나리오용 계정은 전달 전 `MANAGER` 역할이 있는지 확인한다.
- 개인별 계정의 초기 비밀번호를 체험 안내와 함께 전달하고 첫 로그인 후 비밀번호 변경을 요청한다.
- 실제 개인정보와 실제 영수증 업로드 금지를 다시 공지한다.
- 신청서당 첨부 이미지는 기본 최대 10개, 파일당 5MB 이하임을 안내한다.

## 8. 운영 중 로그와 상태 확인

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=100 backend
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=100 frontend
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
```

장애 제보를 받으면 체험자에게 아래 정보를 요청한다.

- 접속 시각
- 계정 아이디
- 수행한 시나리오
- 브라우저와 기기
- 화면 캡처
- 오류 문구

## 9. 업데이트

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d backend frontend
scripts/staging-smoke.sh https://approval-staging.example.com
```

DB migration이 포함된 변경은 업데이트 전에 DB 백업 여부를 결정한다. 업데이트 후에는 관리자 로그인, 신청서 생성, 결재자 승인 흐름을 짧게 재확인한다.

## 10. 체험 종료 정리

체험 종료 후 아래 중 하나를 선택한다.

- 피드백 분석을 위해 DB와 첨부 volume을 일정 기간 보존한다.
- 개인정보 위험을 줄이기 위해 DB와 첨부 volume을 삭제한다.

DB와 첨부파일은 서로 짝이 맞아야 한다. DB만 보존하고 첨부 volume을 삭제하면 신청서 상세의 이미지 미리보기가 깨진다.

삭제 시:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```

보존 시:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml stop
```

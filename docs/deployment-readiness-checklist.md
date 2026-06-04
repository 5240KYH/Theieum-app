# 배포 전 체크리스트

작성일: 2026-06-03

이 문서는 현재 영수증 첨부 전자결재 MVP를 내부 시연 환경에서 운영 후보 환경으로 옮기기 전에 확인할 항목을 정리한다. 현재 `docker-compose.yml`은 로컬 검증용이며, 운영 배포 파일로 그대로 사용하지 않는다.

## 1. 배포 범위 결정

- [ ] 배포 대상이 내부 시연, 사내 파일럿, 운영 중 어디인지 확정한다.
- [ ] 운영 배포라면 `local` profile과 seed 데이터 적용을 끈다.
- [ ] seed 계정(`admin`, `employee01`, `lead-dev`, `approver01`)이 운영 DB에 생성되지 않도록 확인한다.
- [ ] 운영 관리자 계정 생성/초기 비밀번호 전달 절차를 별도로 정한다.

## 2. Secret과 환경변수

- [ ] `JWT_SECRET`을 충분히 긴 난수 문자열로 교체한다.
- [ ] `JWT_SECRET`이 코드, compose 파일, README 예시값, 공유 기본값과 다름을 확인한다.
- [ ] `DB_USERNAME`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`을 환경별 secret 주입 방식으로 관리한다.
- [ ] `FILE_STORAGE_ROOT`를 운영 파일 저장 위치로 지정한다.
- [ ] 운영 환경에서 secret이 컨테이너 로그, 이미지 레이어, git 이력에 남지 않는지 확인한다.

## 3. 데이터베이스와 마이그레이션

- [ ] 운영 DB 백업/복구 절차를 준비한다.
- [ ] Flyway `db/migration`만 운영 적용 대상인지 확인한다.
- [ ] Flyway `db/seed` location은 운영에서 제외한다.
- [ ] 기존 DB가 있다면 마이그레이션 dry-run 또는 스테이징 적용 결과를 확인한다.
- [ ] `approval_histories`, `attachments`, `notification_events` 등 감사/파일/알림 테이블의 보존 기간 정책을 정한다.

## 4. 파일 저장소

- [ ] 첨부 이미지 저장 경로가 컨테이너 재배포 후에도 유지되는 영속 저장소인지 확인한다.
- [ ] 저장소 백업 정책을 DB 백업 정책과 맞춘다.
- [ ] 파일 접근 권한이 backend 프로세스 외부에 열려 있지 않은지 확인한다.
- [ ] 업로드 크기 제한과 허용 MIME 타입 정책이 운영 요구와 맞는지 확인한다.

## 5. 네트워크와 보안

- [ ] 프론트엔드는 HTTPS로 제공한다.
- [ ] `/api/*` 프록시가 backend로만 전달되는지 확인한다.
- [ ] backend API가 외부에 직접 노출될 필요가 없다면 내부 네트워크로 제한한다.
- [ ] PostgreSQL 포트는 외부 공개하지 않는다.
- [ ] CORS, 쿠키/토큰 보관 방식, 토큰 만료 시간을 운영 기준으로 재검토한다.

## 6. 운영 기능 확인

- [ ] 신청자: 영수증 첨부, 임시저장 수정, 제출, 취소 흐름을 확인한다.
- [ ] 결재자: 현재 결재함, 승인, 반려 흐름을 확인한다.
- [ ] 관리자: 전체 신청서 조회, 예외 결재, 조직별 예외 결재자 조회/생성, 알림 로그 조회를 확인한다.
- [ ] 신청 상세에서 첨부 이미지 미리보기와 실제 결재 이력이 표시되는지 확인한다.
- [ ] 권한 없는 사용자가 다른 신청서와 첨부 파일을 조회할 수 없는지 확인한다.

## 7. 검증 명령

배포 후보 커밋에서 아래 명령이 통과해야 한다.

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test
```

```bash
cd frontend
npm run test
npm run build
```

```bash
cd e2e
npm run test
```

```bash
cd /Users/kyh/theieum
docker compose config
git diff --check
```

## 8. 사전 체험 스테이징 체크리스트

- [ ] 스테이징 목적이 정식 운영이 아니라 5~10명 체험임을 공지한다.
- [ ] `docker-compose.staging.yml`과 `.env.staging`로 실행한다.
- [ ] `JWT_SECRET`, `DB_PASSWORD`는 `.env.staging.example` 값이 아니라 새 난수 값으로 교체한다.
- [ ] PostgreSQL과 backend 포트가 외부에 직접 공개되지 않는지 확인한다.
- [ ] HTTPS 접속 URL을 준비한다.
- [ ] 테스트 계정만 배포하고 실제 개인정보를 넣지 않는다.
- [ ] 체험 시작 전 기준정보 테스트 데이터는 `비활성화` 또는 `완전 삭제` 정책에 맞게 정리한다.
- [ ] 사용자, 조직, 직위, 결재선, 예외 결재자의 완전 삭제가 필요한 경우 `ADMIN` 계정으로 참조 차단 메시지를 확인한다.
- [ ] 신청서는 `임시저장` 또는 `취소` 상태만 본인 또는 `ADMIN`이 완전 삭제할 수 있음을 검증한다.
- [ ] `결재중`, `승인완료`, `반려` 신청서는 완전 삭제되지 않는지 확인한다.
- [ ] 체험자에게 `docs/staging-test-guide.md`를 전달한다.
- [ ] 테스트 종료 후 DB와 첨부 이미지 volume 보존 또는 삭제 여부를 결정한다.

## 9. 현재 차단/후속 후보

- [ ] GitHub 원격 push는 현재 로컬 SSH 인증 문제로 실패한다. `git@github.com: Permission denied (publickey)` 해결 후 PR을 생성한다.
- [ ] 반려 신청서 재상신은 정책 결정 후 별도 구현한다.
- [ ] 운영용 compose 또는 배포 템플릿은 로컬 `docker-compose.yml`에서 분리한다.

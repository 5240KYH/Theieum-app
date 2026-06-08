# Task 22 스테이징 체험 운영 전 최종 사용자 시나리오 점검 인수인계

작성일: 2026-06-08, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
기준 커밋: `ef2de84 feat: harden staging attachments and calendar ux`

## 재시작 프롬프트

```text
Task 22 스테이징 체험 운영 전 최종 사용자 시나리오 점검 결과를 이어서 확인해주세요.
```

## 먼저 읽을 문서

```text
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-05-task-22-pre-multi-receipt-attachments.md
docs/handoffs/2026-06-08-task-22-final-user-scenario-check.md
docs/staging-operations-runbook.md
docs/staging-trial-data-and-attachments.md
```

## 검증 범위

- 신청자 화면에서 다중 영수증 이미지 2개 선택, 썸네일 그리드 표시, 작성 화면 확대 미리보기 모달 확인
- 신청서 제출 후 상세 화면에서 첨부 이미지 2개 표시와 상세 확대 미리보기 모달 확인
- 관리자 전체 신청서 화면에서 2026-06 월별 첨부 ZIP 다운로드 버튼과 다운로드 완료 메시지 확인
- 다운로드 ZIP 내부에 2026-06 영수증 일자 기준 첨부 entry가 포함되는지 확인
- 관리자 계정으로 2026-06-10 공용 캘린더 일정 생성
- 모바일 390x844 대시보드에서 일정 칩 클릭 시 `2026-06-10 일정`으로 세부 일정 전환 확인
- 모바일 390x844 대시보드에서 `2026-06-11` 빈 날짜 영역 클릭 시 빈 일정 안내로 세부 일정 전환 확인

## 사용 계정과 테스트 데이터

검증용 Docker compose project:

```text
theieum_task22_verify
```

참고:

- 위 compose project는 검증 당시 사용한 이력이다.
- 이후 컨테이너는 정리되었고, 임시 task별 앱 이미지는 제거했다.
- 앞으로 Docker 검증 시에는 `AGENTS.md` 규칙에 따라 앱 이미지를 task별 임시 이름으로 누적하지 않고, 기본적으로 안정 이미지명(`theieum-backend`, `theieum-frontend`)을 갱신한다.

사용 계정:

```text
employee01/password
admin/password
```

검증 중 생성된 데이터:

```text
신청서: Task22 다중첨부 1780884688261
상세 URL: http://127.0.0.1:3000/applications/2
공용 일정: Task22 모바일 일정 1780884688261
다운로드 ZIP: /private/tmp/task22-monthly-download.zip
```

## 화면 증적

```text
/private/tmp/theieum-task22-visual/01-application-form-multi-attachments.png
/private/tmp/theieum-task22-visual/02-application-form-preview-modal.png
/private/tmp/theieum-task22-visual/03-application-detail-attachments.png
/private/tmp/theieum-task22-visual/04-detail-preview-modal.png
/private/tmp/theieum-task22-visual/05-admin-monthly-download.png
/private/tmp/theieum-task22-visual/06-mobile-dashboard-event-selected.png
/private/tmp/theieum-task22-visual/07-mobile-dashboard-empty-date-selected.png
```

## 실행한 검증

```bash
docker compose -p theieum_task22_verify up --build -d postgres backend frontend
docker compose -p theieum_task22_verify ps
curl -I http://localhost:3000
curl -i -X GET http://localhost:3000/api/auth/login
node /private/tmp/task22-visual-scenario.mjs
unzip -l /private/tmp/task22-monthly-download.zip
docker compose -p theieum_task22_verify logs --tail=80 backend
git diff --check
```

결과:

- `docker compose -p theieum_task22_verify ps` 기준 `postgres`, `backend`, `frontend` 실행 중이고 `postgres`는 healthy다.
- `http://localhost:3000`은 `HTTP/1.1 200 OK`로 응답했다.
- `GET /api/auth/login`은 `405 Method Not Allowed`와 `Allow: POST`로 응답해 API proxy 연결을 확인했다.
- `node /private/tmp/task22-visual-scenario.mjs`는 `ok: true`로 완료되었다.
- ZIP에는 검증 중 생성된 `application-2`의 `task22-receipt-a.png`, `task22-receipt-b.png`가 포함되었다.
- 백엔드 tail 로그에는 검증 시나리오 중 신규 오류 로그가 보이지 않았다. `GET /api/auth/login` smoke로 인한 405 warning은 의도한 확인이다.
- `git diff --check`는 통과했다.

## 판단

- 요청한 네 가지 화면 기준 확인 항목은 통과했다.
- 다중 첨부, 상세 확대 미리보기, 관리자 월별 ZIP 다운로드, 모바일 캘린더 클릭 보정에 대한 추가 코드 수정은 필요하지 않다.

## 남은 확인 사항

- 실제 외부 스테이징 URL 배포 후에는 `docs/staging-operations-runbook.md` 기준으로 `scripts/staging-smoke.sh <URL>`과 `E2E_BASE_URL=<URL> npm run test -- mobile-pwa-staging.spec.ts`를 다시 실행한다.
- 추가 요청이 없다면 Task 22까지 계획된 기능 구현 task는 종료된 상태로 본다.

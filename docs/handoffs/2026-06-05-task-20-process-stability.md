# Task 20 결재 프로세스 안정화 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
기준 브랜치: `main`

## 목표

Oracle VM 배포와 외부 체험 전에 결재 신청, 승인/반려, 권한, 첨부 접근, 알림, 완전 삭제 제한이 흔들리지 않도록 백엔드 회귀 테스트를 보강했다.

## 완료

- Task 20 설계 문서 `docs/superpowers/specs/2026-06-05-process-stability-design.md`를 추가했다.
- Task 20 구현 계획 `docs/superpowers/plans/2026-06-05-process-stability-hardening.md`를 추가했다.
- `ApplicationSubmissionTest`에 제출 경계 테스트를 추가했다.
  - 작성자가 아닌 사용자의 제출 차단
  - 취소 신청서는 재수정 전 제출 차단
- `ApprovalActionTest`에 결재 처리 순서와 terminal 상태 테스트를 추가했다.
  - 미래 결재자의 선행 처리 차단
  - 승인완료 후 반려 차단
  - 반려 후 승인 차단
  - `MANAGER` 예외 결재 audit 기록 확인
- `ApiAuthorizationTest`에 API 권한/알림/삭제 안정화 테스트를 추가했다.
  - 미래 결재자의 상세/첨부 접근은 차례 전 차단, 차례 후 허용
  - 알림 읽음 처리는 수신자만 가능
  - 승인완료/반려 신청서는 신청자와 관리자 API 모두 완전 삭제 차단
- `docs/deployment-readiness-checklist.md`에서 Task 20으로 실제 검증된 항목만 체크했다.

## 프로덕션 코드 변경

없음. 이번 task는 기존 프로세스 동작을 회귀 테스트로 고정하는 안정화 작업이다.

## 검증

호스트는 Java 17이라 Java 21 toolchain 조건을 만족하지 못했다. 백엔드 검증은 Docker Java 21 컨테이너로 수행했다.

```text
docker compose up -d postgres-test: PASS
docker run ... eclipse-temurin:21-jdk ./gradlew test --tests com.theieum.approval.application.ApplicationSubmissionTest --tests com.theieum.approval.application.ApprovalActionTest --tests com.theieum.approval.api.ApiAuthorizationTest: PASS
docker run ... eclipse-temurin:21-jdk ./gradlew test: PASS, 88 tests
git diff --check: PASS
```

## 진행 중 확인한 사항

- 첫 Docker 테스트 실행은 컨테이너 내부 `/private/tmp/theieum-approval-test` 접근 문제로 실패했다. `/private/tmp:/private/tmp`를 마운트한 뒤 정상 통과했다.
- 새 API 테스트가 pending 결재 항목을 남겨 기존 inbox 테스트를 오염시키는 문제가 있었고, 테스트 내에서 다음 단계 처리까지 수행하도록 수정했다.
- 다단계 결재선은 2단계 승인 후에도 다음 단계가 남을 수 있으므로, 해당 API 테스트는 `APPROVED`가 아니라 `IN_APPROVAL`을 기대하도록 정리했다.

## 다음 추천 task

Task 21: 체험 계정/기준정보 및 첨부파일 관리 안정화

권장 범위:

- 30명 안팎 체험자 계정 생성/seed 절차
- `ADMIN`, `MANAGER`, `APPROVER`, 일반 신청자 계정 구분
- 조직/직위/결재선 샘플 데이터 정리
- 첨부파일 허용 형식, 최대 크기, 신청서별 개수 정책
- 첨부파일 보존/삭제/백업/volume 정리 절차
- 체험 종료 후 DB와 첨부파일 정리 절차


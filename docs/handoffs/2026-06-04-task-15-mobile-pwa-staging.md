# Task 15 모바일/PWA 사용성 개선과 외부 체험 스테이징 인수인계

작성 시점: 2026-06-04, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
작업 브랜치: `codex/task-15-mobile-pwa-staging`
기준 설계: `docs/superpowers/specs/2026-06-04-mobile-pwa-staging-design.md`
구현 계획: `docs/superpowers/plans/2026-06-04-mobile-pwa-staging-implementation.md`

## 완료 범위

- 스테이징 compose와 env 예시 추가
- `.env.staging` git 제외 처리
- 외부 체험자 가이드 추가
- README, 배포 전 체크리스트, 관리자 운영 가이드에 staging 안내 반영
- PWA manifest, SVG 아이콘, 모바일 홈 화면 HTML 메타 추가
- 모바일 하단 탭과 더보기 관리 메뉴 추가
- 신청서 작성 모바일 첨부/하단 액션 UX 개선
- 결재함 모바일 카드형 목록 추가
- 신청서 상세 모바일 액션과 결재 이력 카드 추가
- 관리자 기준정보 화면 모바일 보조 컨테이너 추가
- 모바일/PWA Playwright smoke 추가

## 검증 결과

```text
frontend npm run test: PASS, 9 files / 49 tests
frontend npm run build: PASS, Vite build completed with "built"
docker compose config: PASS, 로컬 MVP compose 정적 렌더링 성공
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config: PASS, staging compose 정적 렌더링 성공
e2e mobile-pwa-staging: PASS, 1 passed
git diff --check: PASS
```

Docker 상태 확인:

```text
docker ps: theieum-frontend-1, theieum-backend-1, theieum-postgres-1 running
```

## 다음 확인

- 실제 스테이징 서버에서 HTTPS URL 연결
- 테스트 계정 배포와 비밀번호 변경 안내
- 체험 종료 후 DB와 첨부파일 volume 보존 또는 삭제 결정
- Docker 앱이 실행 중인 환경에서 `e2e/tests/mobile-pwa-staging.spec.ts` 재확인

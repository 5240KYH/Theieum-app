# Task 19 Oracle Always Free 스테이징 배포 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
기준 브랜치: `main`

## 목표

Oracle Cloud Always Free VM에 더이음 스테이징 서버를 올릴 수 있도록 배포 런북과 보안 체크리스트를 준비했다.

## 재시작 트리거

새 채팅에서 아래처럼 요청하면 이 task를 이어서 진행한다.

```text
Oracle Always Free 기반 스테이징 서버 배포를 진행해주세요.
```

응답하는 에이전트는 먼저 이 문서와 `docs/oracle-free-staging-runbook.md`를 읽고, 현재 `git status --short`와 최신 Docker/배포 관련 변경 여부를 확인한 뒤 진행한다. 실제 VM 작업은 Oracle 계정, region, SSH 공개키, staging domain, GitHub public/private 결정이 확인된 후 시작한다.

## 완료

- `.env.staging.example`의 frontend 기본 bind를 `127.0.0.1:3000`으로 조정했다.
- `docs/oracle-free-staging-runbook.md`를 추가했다.
- `docs/superpowers/plans/2026-06-05-oracle-free-staging-deployment.md`를 추가했다.
- README와 배포 체크리스트에 Oracle 배포 경로를 연결했다.
- GitHub public 유지 조건과 private 전환 시 read-only deploy key 방식을 문서화했다.

## 실제 배포 전 필요한 사용자 입력

- Oracle Cloud 계정과 region
- SSH 공개키
- staging domain 또는 임시 도메인
- GitHub public 유지 여부 또는 private 전환 여부

## 검증

```text
FRONTEND_HTTP_PORT=127.0.0.1:3000 docker compose --env-file .env.staging.example -f docker-compose.staging.yml config: PASS
git diff --check: PASS
```

## 다음 실행

1. Oracle VM 생성
2. Docker/Caddy 설치
3. repo clone 또는 deploy key 설정
4. `.env.staging` 작성
5. `docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend`
6. `scripts/staging-smoke.sh https://<staging-domain>`

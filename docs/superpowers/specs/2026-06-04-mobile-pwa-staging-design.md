# Task 15 모바일/PWA 사용성 개선과 외부 체험 스테이징 설계

작성일: 2026-06-04
작업 경로: `/Users/kyh/theieum`
기준 커밋: `c3b396b feat: improve approval line configuration UX`

## 1. 목적

Task 15의 목적은 현재 React/Vite + Spring Boot + PostgreSQL 전자결재 MVP를 외부 테스트 인원 5~10명이 안정적으로 체험할 수 있게 만들고, 동시에 모바일 브라우저와 PWA 설치 환경에서 앱처럼 편하게 사용할 수 있도록 사용성을 개선하는 것이다.

최종 운영 배포가 아니라 사전 체험용 스테이징을 목표로 한다. 따라서 운영급 SSO, 메일/카카오 발송, 외부 파일 스토리지, 정식 앱스토어 배포는 이번 범위에서 제외한다. 대신 외부 URL, HTTPS, 테스트 계정, secret 분리, 테스트 시나리오, 모바일 핵심 흐름 검증을 우선한다.

## 2. 배경과 현재 상태

현재 앱은 Docker Compose로 `frontend`, `backend`, `postgres`를 실행하고, frontend nginx가 `/api/*` 요청을 backend 컨테이너로 프록시한다. `docker-compose.yml`은 로컬 MVP 검증용이며 `SPRING_PROFILES_ACTIVE=local`, seed 계정, compose용 `JWT_SECRET`, 로컬 파일 volume을 포함한다.

기존 문서에는 운영 전 확인 항목이 이미 있다.

- `docs/deployment-readiness-checklist.md`
- `docs/admin-user-guide.md`

Task 15는 이 문서를 대체하지 않고, 사내 파일럿 직전 단계인 "외부 체험용 스테이징"에 맞는 구체 구성을 추가한다.

## 3. 설계 원칙

1. 로컬 MVP compose와 외부 체험 compose를 분리한다.
2. 외부 체험 환경은 작게 만들되, 로컬 PC 상태에 의존하지 않는다.
3. PostgreSQL은 외부에 직접 열지 않는다.
4. backend API는 frontend reverse proxy 뒤에 둔다.
5. 테스트 계정은 실제 개인정보 대신 체험용 데이터를 사용한다.
6. 모바일 UX는 전체 화면 재설계보다 핵심 업무 흐름을 먼저 편하게 만든다.
7. PWA는 "설치 가능한 웹앱" 수준으로 적용하고, 오프라인 업무 처리는 이번 범위에서 제외한다.

## 4. 권장 외부 체험 방식

### 권장안: 작은 스테이징 서버

외부 체험은 작은 VPS 또는 클라우드 VM에 Docker Compose 기반 스테이징 구성을 올리는 방식으로 진행한다. 로컬 PC에서 Cloudflare Tunnel 또는 ngrok으로 즉시 공개하는 방식보다 설정은 조금 더 필요하지만, 다음 장점이 있다.

- 테스트 URL이 안정적이다.
- 로컬 PC 전원, 네트워크, Docker Desktop 상태에 의존하지 않는다.
- DB와 첨부파일 volume을 테스트 기간 동안 보존하기 쉽다.
- 5~10명이 동시에 체험할 때 장애 원인을 구분하기 쉽다.
- 이후 운영 후보 배포로 넘어갈 때 구조를 재사용할 수 있다.

### 보조안: 임시 터널

Cloudflare Tunnel 또는 ngrok은 1~2명에게 아주 빠르게 화면을 보여줄 때만 사용한다. 여러 명이 며칠간 체험하는 환경의 기본안으로 사용하지 않는다.

## 5. 스테이징 아키텍처

```text
Tester Browser / Mobile PWA
  -> HTTPS staging domain
    -> reverse proxy / frontend nginx
      -> /api/* proxy
        -> backend:8080
          -> postgres:5432 on private Docker network
          -> upload-data volume
```

스테이징 서버에는 최소한 다음 서비스가 필요하다.

- `postgres`: 외부 포트 공개 없음
- `backend`: 외부 포트 공개 없음, compose 내부 네트워크에서만 접근
- `frontend`: 외부 HTTPS 진입점
- `upload-data`: 첨부 이미지 영속 volume

HTTPS는 다음 중 하나로 구성한다.

- 서버 앞단에 Caddy 또는 nginx + certbot을 둔다.
- Cloudflare DNS를 사용하는 경우 Cloudflare Tunnel 또는 Cloudflare proxy를 앞단에 둔다.
- PaaS를 쓰는 경우 플랫폼 제공 HTTPS를 사용한다.

## 6. 스테이징 구성 범위

새 파일 후보:

- `docker-compose.staging.yml`
- `.env.staging.example`
- `docs/staging-test-guide.md`
- `docs/handoffs/2026-06-04-task-15-mobile-pwa-staging.md`

수정 파일 후보:

- `README.md`
- `docs/deployment-readiness-checklist.md`
- `docs/admin-user-guide.md`
- `frontend/public/manifest.webmanifest`
- `frontend/index.html`
- `frontend/src/shared/layout/AppLayout.tsx`
- `frontend/src/app/styles.css`
- 모바일/PWA 관련 프론트 테스트 파일

스테이징 compose는 로컬 `docker-compose.yml`을 그대로 외부 공개하지 않는다. 특히 다음 값을 환경변수로 분리한다.

- `JWT_SECRET`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `FILE_STORAGE_ROOT`
- 외부 접속 도메인
- seed 또는 테스트 계정 적용 여부

## 7. 테스트 계정과 데이터 정책

외부 체험 환경에는 실제 직원 개인정보를 넣지 않는다. 테스트 계정은 5~10명 체험자에게 역할별로 배정한다.

권장 계정 묶음:

- 관리자 1명
- 매니저 1명
- 신청자 4~6명
- 결재자 2~3명

초기 비밀번호는 임시값으로 배포하되, 첫 로그인 후 변경을 안내한다. 현재 앱에 "내 비밀번호 변경" 기능이 있으므로 체험 안내서에서 첫 단계로 포함한다.

테스트 종료 후 처리:

- DB dump 보관 여부 결정
- 첨부 이미지 volume 삭제 여부 결정
- 테스트 URL 폐쇄
- 테스트 계정 비활성화 또는 DB 초기화

## 8. 모바일/PWA UX 범위

### 8.1 모바일 내비게이션

현재 모바일에서는 좌측 사이드바가 아이콘형으로 축소된다. 앱처럼 쓰려면 모바일 폭에서는 하단 탭을 우선한다.

하단 탭 기본 항목:

- 대시보드
- 새 신청
- 내 신청서
- 결재함
- 더보기

관리 메뉴는 `더보기` 안에 넣고, `ADMIN` 또는 `MANAGER` 역할에만 노출한다.

### 8.2 모바일 신청서 작성

신청서 작성 화면은 모바일에서 가장 중요한 흐름이다.

개선 방향:

- 영수증 이미지 첨부 영역을 크게 만든다.
- 첨부 후 미리보기와 삭제 버튼을 손가락으로 누르기 쉽게 배치한다.
- 필수 입력 오류는 상단 하나의 요약과 필드 근처 메시지를 함께 제공한다.
- 임시저장과 제출 버튼은 모바일에서 화면 하단에 고정한다.
- 예상 결재선은 접을 수 있는 영역으로 제공하되, 제출 전에는 자동으로 확인 가능해야 한다.

### 8.3 결재함과 상세 화면

결재자는 모바일에서 "확인 후 승인/반려"가 빨라야 한다.

개선 방향:

- 결재함 목록을 카드형으로 전환한다.
- 카드에는 신청자, 금액, 사용처, 신청일, 현재 상태를 표시한다.
- 상세 화면 하단에 승인/반려 버튼을 고정한다.
- 반려 의견 입력은 모바일 모달 또는 하단 시트 형태로 제공한다.

### 8.4 관리자 화면

관리자 기준정보 화면은 표와 복잡한 편집기가 많다. Task 15에서는 모바일 전체 관리자 UX를 완성하지 않고, 체험 중 꼭 필요한 화면만 깨지지 않도록 한다.

우선순위:

1. 사용자 관리
2. 결재선 관리
3. 조직별 예외 결재자
4. 전체 신청서

모바일에서 복잡한 표는 가로 스크롤을 허용하되, 주요 조회 화면은 카드형 표시를 검토한다.

### 8.5 PWA 설치

PWA는 다음 최소 범위로 적용한다.

- `manifest.webmanifest`
- 앱 이름과 짧은 이름
- 아이콘 세트
- theme color
- display mode `standalone`
- iOS 홈 화면 title/meta 보강

서비스 워커와 오프라인 캐시는 이번 범위에서 제외한다. 인증 토큰, 첨부 이미지, 결재 데이터의 캐싱 정책을 아직 확정하지 않았기 때문이다. 브라우저 설치 가능성과 앱 같은 실행감을 먼저 제공한다.

## 9. 체험자 가이드 범위

`docs/staging-test-guide.md`에는 다음 내용을 포함한다.

- 접속 URL
- 권장 브라우저와 모바일 홈 화면 추가 방법
- 테스트 계정 목록
- 첫 로그인 후 비밀번호 변경 안내
- 신청자 시나리오
- 결재자 시나리오
- 관리자 시나리오
- 피드백 작성 양식
- 테스트 기간
- 개인정보/실제 영수증 업로드 금지 안내
- 장애 발생 시 전달할 정보

체험자에게 전달하는 문서는 개발자용 배포 문서와 분리한다.

## 10. 검증 기준

Task 15 완료 조건:

- 프론트 단위 테스트 통과
- 프론트 production build 통과
- staging compose config 검증 통과
- 모바일 viewport에서 핵심 화면 5개 수동 또는 Playwright 확인
- PWA manifest가 브라우저에서 로드됨
- 외부 체험 가이드 문서 작성 완료
- 배포 전 체크리스트에 staging 항목 반영
- 기존 로컬 Docker 실행 방법이 깨지지 않음

검증 후보 명령:

```bash
cd frontend
npm run test
npm run build
```

```bash
cd /Users/kyh/theieum
docker compose config
docker compose -f docker-compose.yml -f docker-compose.staging.yml config
git diff --check
```

Docker 데몬이 꺼져 있거나 권한 문제가 있으면 compose 파일 정적 검증부터 수행하고, 서버 환경에서 실제 기동 검증을 별도로 진행한다.

## 11. 제외 범위

이번 Task 15에서는 다음을 하지 않는다.

- 정식 운영 배포
- 실제 직원 개인정보 import
- 이메일/카카오 알림 발송
- 앱스토어/플레이스토어 배포
- 네이티브 앱 개발
- SSO/OIDC 연동
- S3/MinIO 파일 저장소 전환
- 완전한 오프라인 모드
- 관리자 전체 화면의 모바일 카드형 완성

## 12. 구현 순서 초안

1. 스테이징 배포 파일과 환경변수 예시를 추가한다.
2. 외부 체험자 가이드를 작성한다.
3. PWA manifest와 HTML 메타를 추가한다.
4. 모바일 하단 탭 내비게이션을 추가한다.
5. 신청서 작성 화면의 모바일 액션/첨부 UX를 개선한다.
6. 결재함/상세 화면의 모바일 승인 UX를 개선한다.
7. 관리자 핵심 화면의 모바일 깨짐을 줄인다.
8. 문서와 체크리스트를 갱신한다.
9. 테스트, 빌드, compose config, 모바일 viewport 검증을 수행한다.
10. Task 15 인수인계 문서를 남긴다.

## 13. 결정 사항

- 외부 체험 기본 방식은 작은 스테이징 서버다.
- Cloudflare Tunnel 또는 ngrok은 빠른 임시 공유용 보조안으로만 다룬다.
- PWA는 설치 가능성 중심으로 먼저 적용한다.
- 서비스 워커 오프라인 캐싱은 인증/파일 보안 정책 확정 전까지 보류한다.
- 로컬 MVP compose는 보존하고, staging 구성은 별도 override와 예시 env로 분리한다.

# 프론트엔드 개발 의존성 Audit 메모

작성일: 2026-06-03

## 현재 상태

- `frontend` 운영 의존성 audit: `npm audit --omit=dev` 기준 취약점 0건
- 전체 audit: Vite/esbuild 개발 서버 계열 advisory가 남아 있음
- `npm audit fix --force`는 Vite 8 설치를 요구하며, 현재 Vite 5 기반 설정에 breaking change 가능성이 있음

## 임시 대응

- `frontend/package.json`의 `dev`, `preview` 스크립트에서 `--host 0.0.0.0` 기본 노출을 제거했다.
- 개발 서버는 기본적으로 localhost에만 바인딩되도록 두고, 외부 노출이 필요할 때만 명시적으로 host 옵션을 사용한다.
- 배포 산출물은 Vite 개발 서버를 사용하지 않으며 nginx 정적 서빙으로 제공할 예정이다.

## 후속 작업

- Docker/E2E 단계 전 또는 배포 전 점검에서 Vite/Vitest toolchain major upgrade를 별도 태스크로 검토한다.
- upgrade 시 `npm run test`, `npm run build`, 브라우저 렌더링 검증을 함께 수행한다.

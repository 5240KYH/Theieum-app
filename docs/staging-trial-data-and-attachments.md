# 스테이징 체험 계정과 첨부파일 관리 런북

작성일: 2026-06-05

이 문서는 30명 안팎의 스테이징 체험을 열 때 계정, 기준정보, 첨부파일, 체험 종료 정리를 확인하는 운영자용 절차다. 스테이징은 정식 운영 환경이 아니며 실제 개인정보와 실제 영수증을 넣지 않는다.

## 1. 기본 정책

- `local` profile과 `db/seed`를 사용하는 스테이징 체험 환경에만 seed 계정을 만든다.
- 운영 배포에서는 `db/seed` location을 제외하고 운영 계정을 별도로 만든다.
- 체험자는 가능하면 개인별 계정으로 배정한다.
- 개인별 계정은 첫 로그인 후 비밀번호 변경을 요청한다.
- 공유 확인용 계정은 다음 체험자가 잠기지 않도록 비밀번호 변경을 요청하지 않는다.
- 실제 이름, 실제 연락처, 실제 영수증 이미지는 업로드하지 않도록 안내한다.

## 2. 계정 풀

모든 seed 계정의 초기 비밀번호는 `password`다.

| 구분 | 계정 | 역할 | 권장 용도 |
| --- | --- | --- | --- |
| 기본 관리자 | `admin` | `ADMIN`, `APPROVER`, `APPLICANT` | 운영자 사전 점검 |
| 기본 신청자 | `employee01` | `APPLICANT` | 기본 E2E 신청 흐름 |
| 기본 결재자 | `lead-dev` | `APPROVER`, `APPLICANT` | 개발팀 예외 결재 승인 |
| 기본 결재자 | `approver01` | `APPROVER` | 기본 결재선 승인 |
| 신청자 | `employee02` ~ `employee12` | `APPLICANT` | 개인별 신청자 체험 |
| 신청자 | `support01` ~ `support03` | `APPLICANT` | 경영지원팀 신청자 체험 |
| 결재자 | `lead-sales` | `APPROVER`, `APPLICANT` | 영업팀 결재 체험 |
| 결재자 | `ceo` | `APPROVER` | 최종 결재 체험 |
| 체험 신청자 | `trial-applicant01` ~ `trial-applicant06` | `APPLICANT` | 30명 안팎 체험 확장용 |
| 체험 결재자 | `trial-approver01`, `trial-approver02` | `APPROVER`, `APPLICANT` | 결재자 역할 체험 |
| 체험 매니저 | `trial-manager01` | `MANAGER`, `APPROVER`, `APPLICANT` | 매니저 관리/예외 결재 체험 |
| 체험 관리자 | `trial-admin01` | `ADMIN`, `APPROVER`, `APPLICANT` | 관리자 체험 또는 보조 운영자 |

## 3. 배정 권장안

30명 안팎 체험에서는 아래처럼 나눈다.

| 역할 | 권장 인원 | 계정 후보 |
| --- | ---: | --- |
| 일반 신청자 | 20명 내외 | `employee01` ~ `employee12`, `support01` ~ `support03`, `trial-applicant01` ~ `trial-applicant06` |
| 결재자 | 5명 내외 | `approver01`, `lead-dev`, `lead-sales`, `ceo`, `trial-approver01`, `trial-approver02` |
| 매니저 | 1~2명 | `trial-manager01` |
| 관리자 | 1~2명 | `admin`, `trial-admin01` |

같은 시간에 여러 사람이 같은 계정을 쓰면 비밀번호 변경과 데이터 충돌이 생길 수 있다. 체험자 수가 계정 풀보다 많으면 체험 시간을 나누거나, 관리자가 사용자 관리 화면에서 추가 계정을 만든 뒤 개인별로 전달한다.

## 4. 기준정보 점검

체험 시작 전 관리자 계정으로 아래를 확인한다.

- 사용자 관리에서 체험자에게 줄 계정이 모두 활성 상태인지 확인한다.
- 조직은 기존 `더이음`, `경영지원팀`, `개발팀`, `영업팀`과 새 `더이음사랑의교회` 조직 트리가 활성 상태인지 확인한다.
- 직위는 `사원`, `대리`, `과장`, `팀장`, `대표`가 활성 상태인지 확인한다.
- 결재선은 `영수증 첨부 신청 기본 결재선`이 활성 상태인지 확인한다.
- 개발팀 예외 결재자가 `lead-dev`로 설정되어 있는지 확인한다.
- 매니저 체험 계정은 `MANAGER` 역할이 있는지 확인한다.
- 다중 소속 체험 계정은 사용자 관리에서 소속 목록, 대표 소속 1개, 대표 소속 활성 상태를 확인한다.

Task 23 seed 기준 새 조직 트리는 아래와 같다.

```text
더이음사랑의교회
├─ 예배부
│  ├─ 찬양팀
│  ├─ 미디어팀
│  ├─ 새가족팀
│  └─ 중보기도팀
├─ 총무부
│  ├─ 기획팀
│  └─ 시설팀
├─ 재정부
│  ├─ 회계팀
│  └─ 감사팀
└─ 미래준비부
   ├─ 이음씨드
   └─ 이음키즈
```

### 4.1 다중 소속/결재 기준 조직 체험 점검

다중 소속 또는 겸직 체험을 진행할 때는 아래 흐름을 확인한다.

- 관리자 사용자 관리에서 한 사용자에게 활성 소속을 2개 이상 배정한다.
- 대표 소속은 1개만 지정하고, 대표 소속이 활성 상태인지 확인한다.
- 저장 후 사용자 목록의 대표 조직 표시와 소속 목록 표시가 함께 맞는지 확인한다.
- 신청서 작성/수정 화면에서 `결재 기준 조직` 선택지가 본인의 활성 소속만 보여주는지 확인한다.
- 대표 소속이 기본 선택되는지 확인한다.
- 다른 활성 소속을 선택했을 때 예상 결재선이 선택 조직 기준으로 다시 계산되는지 확인한다.
- 제출 후 신청서 상세의 결재 기준 조직과 결재 단계가 작성/수정에서 선택한 조직 기준으로 고정되는지 확인한다.
- 제출 API에 별도 조직 ID를 붙이지 않아도, 임시저장/수정에 저장된 `approvalOrganizationId` 기준으로 제출되는지 확인한다.

## 5. 첨부파일 정책

기본 서버 정책은 아래와 같다.

| 항목 | 기본값 | 설정 키 |
| --- | ---: | --- |
| 허용 형식 | `image/*` MIME 타입과 PNG/JPEG/GIF/WebP/BMP signature | 코드 검증 |
| 파일 크기 | 5MB 이하 | `ATTACHMENT_MAX_IMAGE_BYTES=5242880` |
| 신청서당 첨부 개수 | 10개 | `ATTACHMENT_MAX_FILES_PER_APPLICATION=10` |

스테이징 서버에서는 `.env.staging`에 아래 값을 명시한다.

```dotenv
ATTACHMENT_MAX_IMAGE_BYTES=5242880
ATTACHMENT_MAX_FILES_PER_APPLICATION=10
```

프론트엔드도 5MB 초과 이미지를 먼저 차단한다. 서버 제한은 프론트 우회, 직접 API 호출, 브라우저 차이에 대비한 최종 방어선이다.

관리자는 `전체 신청서 관리` 화면에서 월을 선택해 해당 영수증 월의 첨부 이미지를 ZIP으로 내려받을 수 있다. ZIP은 신청서 영수증 일자 기준 월로 묶이며, 파일명에는 신청서 ID, 영수증 일자, 사용처, 첨부 ID가 포함된다.

## 6. 첨부파일 저장 위치

스테이징 compose 기준 첨부파일은 backend 컨테이너의 `/app/uploads`에 저장되고, Docker volume `upload-staging-data`에 보존된다.

상태 확인:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml exec backend sh -lc 'find /app/uploads -type f | wc -l'
```

첨부 미리보기가 보이지 않으면 아래를 확인한다.

- backend 컨테이너가 실행 중인지 확인한다.
- `FILE_STORAGE_ROOT=/app/uploads`가 적용되어 있는지 확인한다.
- `upload-staging-data` volume이 backend에 마운트되어 있는지 확인한다.
- 신청서 상세를 보는 사용자가 작성자, 현재/과거 결재자, 관리자 중 하나인지 확인한다.

## 7. 백업과 보존

체험 데이터 분석이 필요하면 DB와 첨부 volume을 함께 보존한다. DB만 백업하고 첨부 volume을 삭제하면 신청서 상세의 이미지 미리보기가 깨진다.

정지 보존:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml stop
```

DB dump 예시:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml exec postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > staging-db-backup.sql
```

첨부파일 보존은 VM의 Docker volume 백업 정책에 맞춘다. 단순 파일 복사가 필요하면 백업 경로와 권한을 먼저 정한 뒤 서버에서 수행한다.

## 8. 체험 종료 삭제

체험 데이터가 필요 없거나 개인정보 위험을 줄여야 하면 DB와 첨부 volume을 함께 삭제한다.

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```

삭제 후에는 아래 명령으로 staging volume이 사라졌는지 확인한다.

```bash
docker volume ls | grep theieum
```

삭제 전에는 운영자가 아래를 확인한다.

- 피드백 분석에 필요한 신청서와 첨부 이미지가 남아 있지 않아도 되는가
- 재현이 필요한 장애 제보가 모두 정리되었는가
- 체험자에게 실제 개인정보와 실제 영수증을 넣지 말라고 공지했는가
- `.env.staging`, DB dump, 첨부 백업 파일이 git에 포함되지 않는가
